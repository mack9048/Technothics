<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use App\Http;
use App\HttpError;

final class Production
{
    public static function show(): array
    {
        $models = Db::all('SELECT * FROM models ORDER BY id');
        $name = $_GET['model'] ?? '1100VA Home';
        $model = null;
        foreach ($models as $m) {
            if ($m['name'] === $name) {
                $model = $m;
            }
        }
        $model ??= $models[1] ?? $models[0];

        $lines = Db::all(
            'SELECT b.*, i.on_hand, i.reserved FROM bom_lines b LEFT JOIN items i ON i.id = b.item_id
             WHERE b.model_id = ? ORDER BY b.id',
            [$model['id']]
        );
        $bom = array_map(function ($l) {
            // Units we can still build from free stock (on hand, reserved stock already belongs to batches).
            $cover = $l['item_id'] !== null
                ? intdiv(max(0, (int) $l['on_hand']), max(1, (int) $l['per_unit']))
                : (int) $l['cover_units'];
            return [
                'component' => $l['component'],
                'spec' => $l['spec'],
                'qty' => $l['qty'],
                'unit' => (float) $l['unit_price'],
                'line' => (float) $l['unit_price'] * (int) $l['per_unit'],
                'cover' => $cover,
                'low' => $cover < 12,
            ];
        }, $lines);
        $bomTotal = array_sum(array_column($bom, 'line'));
        $landed = $bomTotal + (float) $model['labour'] + (float) $model['overhead'];
        $m = Db::metric('production');

        return [
            'models' => array_column($models, 'name'),
            'model' => [
                'name' => $model['name'],
                'code' => $model['code'],
                'labour' => (float) $model['labour'],
                'overhead' => (float) $model['overhead'],
                'dealer_price' => (float) $model['dealer_price'],
            ],
            'bom' => $bom,
            'bom_total' => $bomTotal,
            'landed' => $landed,
            'margin' => $model['dealer_price'] > 0 ? round(($model['dealer_price'] - $landed) / $model['dealer_price'] * 100, 1) : 0,
            'next_serial' => self::nextSerialNo((int) $model['id'], (int) ($m['next_serial'] ?? 1)),
            'yymm' => date('ym'),
            'stats' => ['active_models' => count($models), 'units_on_line' => (int) ($m['units_on_line'] ?? 0)],
            'batches' => Db::all(
                'SELECT b.code, m.name AS model, b.qty, b.stage, b.serial_from, b.serial_to, b.progress
                 FROM batches b JOIN models m ON m.id = b.model_id ORDER BY b.code DESC LIMIT 8'
            ),
        ];
    }

    private static function nextSerialNo(int $modelId, int $fallback): int
    {
        $last = Db::one('SELECT serial_to FROM batches WHERE model_id = ? ORDER BY id DESC LIMIT 1', [$modelId]);
        $n = $last ? (int) substr((string) $last['serial_to'], -5) + 1 : $fallback;
        return max($n, $fallback);
    }

    /** POST /batches {model, qty, labour?, overhead?}: reserve parts and issue a serial range. */
    public static function startBatch(): array
    {
        $in = Http::body();
        Http::required($in, ['model', 'qty']);
        $qty = (int) $in['qty'];
        if ($qty < 1 || $qty > 200) {
            throw new HttpError(422, 'Quantity must be 1–200');
        }
        $model = Db::one('SELECT * FROM models WHERE name = ?', [$in['model']]) ?? throw new HttpError(404, 'Unknown model');

        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            foreach (['labour', 'overhead'] as $k) {
                if (isset($in[$k]) && is_numeric($in[$k])) {
                    Db::exec("UPDATE models SET $k = ? WHERE id = ?", [(float) $in[$k], $model['id']]);
                }
            }
            $short = [];
            foreach (Db::all('SELECT b.per_unit, i.id, i.name, i.on_hand FROM bom_lines b JOIN items i ON i.id = b.item_id WHERE b.model_id = ?', [$model['id']]) as $p) {
                $need = (int) $p['per_unit'] * $qty;
                if ($need > (int) $p['on_hand']) {
                    $short[] = $p['name'];
                }
                Db::exec('UPDATE items SET reserved = reserved + ? WHERE id = ?', [$need, $p['id']]);
            }
            $m = Db::metric('production');
            $from = self::nextSerialNo((int) $model['id'], (int) ($m['next_serial'] ?? 1));
            $yymm = date('ym');
            $prefix = "INV-{$model['code']}-$yymm-";
            $count = 1 + max(0, ...array_map(
                fn ($r) => (int) substr((string) $r['code'], -2),
                Db::all('SELECT code FROM batches WHERE code LIKE ?', ["B-$yymm-%"])
            ));
            $batch = [
                'code' => sprintf('B-%s-%02d', $yymm, $count),
                'model_id' => $model['id'],
                'qty' => $qty,
                'stage' => 'Assembly',
                'serial_from' => $prefix . str_pad((string) $from, 5, '0', STR_PAD_LEFT),
                'serial_to' => str_pad((string) ($from + $qty - 1), 5, '0', STR_PAD_LEFT),
                'progress' => 5,
            ];
            Db::insert('batches', $batch);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return ['batch' => $batch + ['model' => $model['name']], 'short_parts' => $short];
    }
}
