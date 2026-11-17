<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use App\Format;
use App\Http;
use App\HttpError;

final class Service
{
    private const FILTERS = [
        'Warranty' => "tag = 'Warranty'",
        'Chargeable' => "tag = 'Chargeable'",
        'Multi-brand' => "kind = 'multi'",
        'Closed' => "stage = 'Closed'",
    ];

    public static function show(): array
    {
        $filter = $_GET['filter'] ?? 'All calls';
        $where = self::FILTERS[$filter] ?? "stage <> 'Closed'";
        $q = trim((string) ($_GET['q'] ?? ''));
        $params = [];
        if ($q !== '') {
            $where .= ' AND (code LIKE ? OR phone LIKE ? OR serial LIKE ? OR customer LIKE ?)';
            $params = array_fill(0, 4, "%$q%");
        }
        $tickets = Db::all("SELECT * FROM tickets WHERE $where ORDER BY id DESC LIMIT 25", $params);

        return [
            'stats' => Db::metric('service'),
            'tickets' => array_map([self::class, 'present'], $tickets),
            'techs' => self::techsToday(),
        ];
    }

    public static function present(array $t): array
    {
        $t['date'] = Format::date($t['registered_on']);
        $t['approved'] = (bool) $t['approved'];
        if ($t['serial']) {
            $w = Warranty::lookup($t['serial']);
            $t['warranty_line'] = $w ? $w['line'] : 'Serial not found';
            $t['batch_line'] = $w ? "Built in batch {$w['batch']} · {$w['history']}" : '';
        }
        $lines = $t['inspection'] ? json_decode((string) $t['inspection'], true) : null;
        unset($t['inspection']);
        if ($lines) {
            $t['inspection'] = [
                'by' => $t['tech'],
                'fault' => $t['fault'],
                'lines' => array_map(fn ($l) => ['label' => $l[0], 'amount' => $l[1]], $lines),
            ];
            $sub = array_sum(array_column($lines, 1));
            $t['proforma'] = [
                'no' => $t['proforma_no'],
                'subtotal' => $sub,
                'gst' => round($sub * 0.18),
                'total' => round($sub * 1.18),
                'sent' => $t['proforma_sent'] ?: 'Not sent yet',
            ];
        }
        return $t;
    }

    private static function techsToday(): array
    {
        $status = ['Rahul' => ['Kakkanad', 'On site'], 'Ajmal' => ['Edappally', 'On site'], 'Vishnu' => ['Bench', 'Workshop'], 'Sanoop' => ['Aluva', 'Free']];
        $out = [];
        foreach (Db::all("SELECT name, initials FROM employees WHERE role = 'Field technician' ORDER BY id") as $e) {
            $open = (int) Db::one("SELECT COUNT(*) AS n FROM tickets WHERE tech = ? AND stage <> 'Closed'", [$e['name']])['n'];
            [$area, $st] = $status[$e['name']] ?? ['—', 'Free'];
            $out[] = [
                'init' => $e['initials'],
                'name' => $e['name'],
                'area' => $area,
                'jobs' => $open . ($st === 'Workshop' ? ' repair' : ' job') . ($open === 1 ? '' : 's'),
                'status' => $st,
            ];
        }
        return $out;
    }

    /** POST /service/tickets {phone, serial, complaint, customer?, auto_assign?} */
    public static function create(): array
    {
        $in = Http::body();
        Http::required($in, ['phone', 'serial', 'complaint']);
        $serial = strtoupper(trim((string) $in['serial']));
        $w = Warranty::lookup($serial);
        $own = $w !== null;
        $tech = null;
        if (!empty($in['auto_assign'])) {
            // nearest free technician: fewest open tickets
            $row = Db::one("SELECT e.name, (SELECT COUNT(*) FROM tickets t WHERE t.tech = e.name AND t.stage <> 'Closed') AS n
                            FROM employees e WHERE e.role = 'Field technician' ORDER BY n, e.id LIMIT 1");
            $tech = $row['name'] ?? null;
        }
        $next = max(1000, ...array_map(fn ($r) => (int) substr((string) $r['code'], 3), Db::all('SELECT code FROM tickets'))) + 1;
        $ticket = [
            'code' => 'SR-' . $next,
            'kind' => $own ? 'own' : 'multi',
            'customer' => trim((string) ($in['customer'] ?? '')) ?: ($w['customer'] ?? 'Walk-in customer'),
            'product' => $own ? 'Own ' . $w['model'] : trim((string) $in['serial']) . ' · other brand',
            'serial' => $own ? $serial : null,
            'tag' => $own ? ($w['in_warranty'] ? 'Warranty' : 'Chargeable') : 'Multi-brand',
            'stage' => $tech ? 'Assigned' : 'Registered',
            'tech' => $tech,
            'registered_on' => date('Y-m-d'),
            'phone' => trim((string) $in['phone']),
            'complaint' => trim((string) $in['complaint']),
        ];
        Db::insert('tickets', $ticket);
        return ['ticket' => self::present(Db::one('SELECT * FROM tickets WHERE code = ?', [$ticket['code']]))];
    }

    /** POST /service/tickets/{code}/approve */
    public static function approve(array $p): array
    {
        $n = Db::exec("UPDATE tickets SET approved = 1, stage = 'Approved' WHERE code = ?", [$p['code']]);
        if ($n === 0) {
            throw new HttpError(404, 'Ticket not found');
        }
        return ['ticket' => self::present(Db::one('SELECT * FROM tickets WHERE code = ?', [$p['code']]))];
    }

    /** POST /service/tickets/{code}/resend — re-sends the proforma (WhatsApp/SMS integration hooks in here). */
    public static function resend(array $p): array
    {
        $sent = 'Resent on WhatsApp ' . date('d M, g:i a');
        if (Db::exec('UPDATE tickets SET proforma_sent = ? WHERE code = ? AND proforma_no IS NOT NULL', [$sent, $p['code']]) === 0) {
            throw new HttpError(404, 'No proforma for this ticket');
        }
        return ['ticket' => self::present(Db::one('SELECT * FROM tickets WHERE code = ?', [$p['code']]))];
    }

    /** POST /service/tickets/{code}/close */
    public static function close(array $p): array
    {
        $n = Db::exec("UPDATE tickets SET stage = 'Closed' WHERE code = ?", [$p['code']]);
        if ($n === 0) {
            throw new HttpError(404, 'Ticket not found');
        }
        return ['ticket' => self::present(Db::one('SELECT * FROM tickets WHERE code = ?', [$p['code']]))];
    }
}
