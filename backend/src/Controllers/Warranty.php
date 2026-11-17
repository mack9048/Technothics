<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use App\Format;
use App\HttpError;

final class Warranty
{
    public static function lookup(string $serial): ?array
    {
        $s = Db::one('SELECT s.*, m.name AS model FROM serials s JOIN models m ON m.id = s.model_id WHERE s.serial = ?', [strtoupper(trim($serial))]);
        if (!$s) {
            return null;
        }
        $in = $s['warranty_till'] && strtotime($s['warranty_till']) >= strtotime('today');
        return [
            'serial' => $s['serial'],
            'model' => $s['model'],
            'batch' => $s['batch'],
            'history' => $s['history'],
            'customer' => $s['customer'],
            'sold_on' => Format::date($s['sold_on'], true),
            'warranty_till' => Format::date($s['warranty_till'], true),
            'in_warranty' => $in,
            'line' => $in
                ? 'In warranty · valid till ' . Format::date($s['warranty_till'], true)
                : 'Warranty ended ' . Format::date($s['warranty_till'], true) . ' · chargeable',
        ];
    }

    public static function show(array $p): array
    {
        return self::lookup($p['serial']) ?? throw new HttpError(404, 'Serial number not found');
    }
}
