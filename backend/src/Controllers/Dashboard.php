<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;

final class Dashboard
{
    public static function show(): array
    {
        $m = Db::metric('dashboard');
        $models = Db::all('SELECT name, units_month FROM models ORDER BY id');
        $maxUnits = 75; // bar scale: monthly line capacity per model
        $model = Db::one("SELECT * FROM models WHERE name = '1100VA Home'");
        $bom = $model ? (float) Db::one('SELECT SUM(unit_price * per_unit) AS t FROM bom_lines WHERE model_id = ?', [$model['id']])['t'] : 0;
        $landed = $bom + (float) ($model['labour'] ?? 0) + (float) ($model['overhead'] ?? 0);

        return [
            'stats' => $m,
            'inspect' => Db::all("SELECT code, customer, COALESCE(tech, 'Unassigned') AS tech FROM tickets
                                  WHERE stage = 'Awaiting inspection' ORDER BY code LIMIT 3"),
            'low_stock' => Db::all('SELECT name, reorder_level, on_hand FROM items WHERE on_hand < reorder_level ORDER BY id'),
            'production' => array_map(fn ($r) => [
                'name' => $r['name'],
                'units' => (int) $r['units_month'],
                'pct' => min(100, (int) round($r['units_month'] / $maxUnits * 100)),
            ], $models),
            'landed' => [
                'model' => $model['name'] ?? '',
                'bom' => $bom,
                'labour' => (float) ($model['labour'] ?? 0),
                'overhead' => (float) ($model['overhead'] ?? 0),
                'total' => $landed,
                'price' => (float) ($model['dealer_price'] ?? 0),
                'margin' => $model && $model['dealer_price'] > 0 ? round(($model['dealer_price'] - $landed) / $model['dealer_price'] * 100, 1) : 0,
            ],
        ];
    }
}
