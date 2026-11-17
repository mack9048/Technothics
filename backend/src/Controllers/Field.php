<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;

final class Field
{
    public static function show(): array
    {
        $m = Db::metric('field');
        $period = ($_GET['period'] ?? 'week') === 'month' ? 'month' : 'week';
        return [
            'date' => $m['date'] ?? '',
            'stats' => [
                'techs_out' => $m['techs_out'] ?? '',
                'jobs_today' => $m['jobs_today'] ?? 0,
                'closed' => $m['closed'] ?? 0,
                'to_centre' => $m['to_centre'] ?? 0,
            ],
            'flow' => $m['flow'] ?? [],
            'live' => $m['live'] ?? [],
            'period' => $period,
            'kpis' => $m['kpis'][$period] ?? [],
            'efficiency' => $m['efficiency'] ?? [],
        ];
    }
}
