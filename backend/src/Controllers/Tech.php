<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use App\Format;
use App\Http;
use App\HttpError;

/** Endpoints used by the technician mobile app. */
final class Tech
{
    private const LABOUR = 600; // flat service charge, SAC 9987
    private const GST = 0.18;

    private static function ticket(string $code): array
    {
        return Db::one('SELECT * FROM tickets WHERE code = ?', [$code]) ?? throw new HttpError(404, 'Job not found');
    }

    /** GET /tech/jobs?tech=Name — open jobs for the technician app's home screen. */
    public static function jobs(): array
    {
        $tech = trim((string) ($_GET['tech'] ?? ''));
        $rows = $tech === ''
            ? Db::all("SELECT * FROM tickets WHERE stage <> 'Closed' AND tech IS NOT NULL ORDER BY id DESC")
            : Db::all("SELECT * FROM tickets WHERE stage <> 'Closed' AND tech = ? ORDER BY id DESC", [$tech]);
        return ['jobs' => array_map(fn ($t) => [
            'code' => $t['code'],
            'customer' => $t['customer'],
            'address' => $t['address'],
            'product' => $t['product'],
            'stage' => $t['stage'],
            'tag' => $t['tag'],
            'tech' => $t['tech'],
            'complaint' => $t['complaint'] ?: $t['fault'],
        ], $rows)];
    }

    /** GET /tech/jobs/{code} */
    public static function job(array $p): array
    {
        $t = self::ticket($p['code']);
        $van = Db::one('SELECT items FROM vans WHERE tech = ?', [$t['tech']]);
        return [
            'code' => $t['code'],
            'stage' => $t['stage'],
            'customer' => $t['customer'],
            'address' => $t['address'],
            'complaint' => $t['complaint'] ?: $t['fault'],
            'phone' => $t['phone'],
            'product' => $t['product'],
            'warranty' => $t['serial'] ? Warranty::lookup($t['serial']) : null,
            'van_count' => (int) ($van['items'] ?? 0),
            'labour' => self::LABOUR,
            'gst_rate' => self::GST,
            'faults' => ['Fan seized', 'MOSFET short', 'Battery', 'Wiring', 'PCB', 'Other'],
            'van_parts' => array_map(fn ($i) => ['name' => $i['name'], 'price' => (float) $i['sale_price'], 'hsn' => $i['hsn']],
                Db::all("SELECT name, sale_price, hsn FROM items WHERE in_vans > 0 AND name IN ('12V DC fan', 'IRFZ44N MOSFET', 'Charging relay 30A') ORDER BY CASE name WHEN '12V DC fan' THEN 0 WHEN 'IRFZ44N MOSFET' THEN 1 ELSE 2 END")),
        ];
    }

    /** POST /tech/jobs/{code}/report — saves fault, parts and step data; "send to office". */
    public static function report(array $p): array
    {
        $t = self::ticket($p['code']);
        $in = Http::body();
        Db::insert('job_reports', ['ticket_code' => $t['code'], 'kind' => (string) ($in['kind'] ?? 'report'), 'payload' => json_encode($in, JSON_UNESCAPED_UNICODE)]);
        if (!empty($in['fault'])) {
            Db::exec('UPDATE tickets SET fault = ? WHERE code = ?', [$in['fault'], $t['code']]);
        }
        if (!empty($in['parts']) && is_array($in['parts'])) {
            $txt = implode(', ', array_map(fn ($x) => $x['name'] . ' × ' . (int) $x['qty'], array_filter($in['parts'], fn ($x) => (int) ($x['qty'] ?? 0) > 0)));
            Db::exec('UPDATE tickets SET parts = ?, stage = ? WHERE code = ?', [$txt ?: null, 'Parts logged', $t['code']]);
        }
        return ['ok' => true];
    }

    /** POST /tech/jobs/{code}/invoice {parts:[{name, qty}]} — builds the GST tax invoice preview. */
    public static function invoice(array $p): array
    {
        $t = self::ticket($p['code']);
        $parts = (array) (Http::body()['parts'] ?? []);
        $lines = [];
        foreach ($parts as $x) {
            $qty = (int) ($x['qty'] ?? 0);
            $i = Db::one('SELECT name, sale_price, hsn FROM items WHERE name = ?', [$x['name'] ?? '']);
            if ($i && $qty > 0) {
                $lines[] = ['label' => "{$i['name']} × $qty", 'code' => 'HSN ' . $i['hsn'], 'amount' => $qty * (float) $i['sale_price'], 'name' => $i['name'], 'qty' => $qty];
            }
        }
        $lines[] = ['label' => 'Service charge', 'code' => 'SAC 9987', 'amount' => self::LABOUR];
        $taxable = array_sum(array_column($lines, 'amount'));
        $half = round($taxable * self::GST / 2, 2);
        $prefix = 'TI-' . date('ym') . '-';
        $last = Db::one('SELECT no FROM documents WHERE no LIKE ? ORDER BY no DESC LIMIT 1', [$prefix . '%']);
        $seq = $last ? (int) substr((string) $last['no'], strlen($prefix)) + 1 : 1;
        return [
            'no' => $prefix . str_pad((string) $seq, 3, '0', STR_PAD_LEFT),
            'date' => Format::date(date('Y-m-d'), true),
            'bill_to' => $t['customer'],
            'job' => $t['code'],
            'serial' => $t['serial'],
            'lines' => $lines,
            'taxable' => $taxable,
            'cgst' => $half,
            'sgst' => $half,
            'total' => round($taxable + 2 * $half),
        ];
    }

    /** POST /tech/jobs/{code}/collect {method: UPI|Cash|Later, parts, whatsapp} — closes the job. */
    public static function collect(array $p): array
    {
        $t = self::ticket($p['code']);
        $in = Http::body();
        $method = $in['method'] ?? '';
        if (!in_array($method, ['UPI', 'Cash', 'Later'], true)) {
            throw new HttpError(422, 'method must be UPI, Cash or Later');
        }
        $inv = self::invoice($p);
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            Db::insert('documents', ['type' => 'Tax inv.', 'no' => $inv['no'], 'party' => $t['customer'] . ' (service)', 'doc_date' => date('Y-m-d'), 'amount' => $inv['total']]);
            if ($method !== 'Later') {
                Db::insert('payments', ['ticket_code' => $t['code'], 'invoice_no' => $inv['no'], 'method' => $method, 'amount' => $inv['total']]);
            }
            // parts leave the technician's van
            foreach ($inv['lines'] as $l) {
                if (isset($l['name'])) {
                    Db::exec('UPDATE items SET in_vans = CASE WHEN in_vans > ? THEN in_vans - ? ELSE 0 END WHERE name = ?', [$l['qty'], $l['qty'], $l['name']]);
                }
            }
            Db::exec("UPDATE tickets SET stage = 'Closed' WHERE code = ?", [$t['code']]);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return ['invoice' => $inv, 'method' => $method, 'status' => 'Closed'];
    }

    /** GET /tech/onsite/{code} — data for the 6-step on-site flow. */
    public static function onsite(array $p): array
    {
        $t = self::ticket($p['code']);
        return [
            'code' => $t['code'],
            'customer' => $t['customer'] . ($t['address'] ? ', ' . $t['address'] : ''),
            'product' => $t['product'],
            'phone' => $t['phone'],
            'warranty' => $t['serial'] ? Warranty::lookup($t['serial']) : null,
            'faults' => ['Weak battery', 'MOSFET short', 'Fan', 'Wiring / earthing', 'Transformer', 'PCB'],
            'readings' => [
                ['id' => 'mains', 'label' => 'Mains input (V)', 'value' => '232'],
                ['id' => 'battery', 'label' => 'Battery (V, on load)', 'value' => '10.6'],
                ['id' => 'output', 'label' => 'Output (V)', 'value' => '226'],
                ['id' => 'load', 'label' => 'Connected load (W)', 'value' => '420'],
            ],
            'checks' => [
                ['label' => 'Wiring & connections', 'ok' => true], ['label' => 'Earthing', 'ok' => true],
                ['label' => 'Cooling fan', 'ok' => true], ['label' => 'Display & alarms', 'ok' => true],
                ['label' => 'Battery water level', 'ok' => false],
            ],
            'quote' => [
                'no' => 'Q-2611-044',
                'note' => 'Battery not under warranty',
                'lines' => [
                    ['label' => '150Ah tubular battery', 'amount' => 13900, 'gst' => 0.28],
                    ['label' => 'Terminal set', 'amount' => 180, 'gst' => 0.18],
                ],
                'free_line' => 'Inverter service',
            ],
            'tasks' => [
                ['label' => 'Old battery removed & tagged', 'ok' => true], ['label' => 'New battery fitted, terminals greased', 'ok' => true],
                ['label' => 'Charging current set', 'ok' => false], ['label' => 'Area cleaned', 'ok' => false],
            ],
        ];
    }
}
