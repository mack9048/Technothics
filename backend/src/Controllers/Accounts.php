<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;

final class Accounts
{
    public static function show(): array
    {
        $m = Db::metric('accounts');
        return [
            'fy' => $m['fy'] ?? '',
            'balances' => [
                ['label' => 'Cash in hand', 'amount' => $m['cash_in_hand'] ?? 0],
                ['label' => 'Bank balance', 'amount' => $m['bank_balance'] ?? 0],
                ['label' => 'To receive', 'amount' => $m['to_receive'] ?? 0],
                ['label' => 'To pay', 'amount' => $m['to_pay'] ?? 0],
                ['label' => 'GST payable (Nov)', 'amount' => $m['gst_payable'] ?? 0],
            ],
        ];
    }

    public static function profitability(): array
    {
        $m = Db::metric('accounts');
        $lines = array_map(function ($l) {
            $profit = $l['rev'] - $l['cost'];
            $margin = $l['rev'] > 0 ? round($profit / $l['rev'] * 100, 1) : null;
            return $l + ['profit' => $profit, 'margin' => $margin];
        }, $m['profit_lines'] ?? []);

        return [
            'month' => $m['month'] ?? '',
            'bank_reconciled_pct' => $m['bank_reconciled_pct'] ?? 0,
            'to_receive' => $m['to_receive'] ?? 0,
            'to_pay' => $m['to_pay'] ?? 0,
            'lines' => $lines,
            'gst' => $m['gst'] ?? [],
            'bank' => $m['bank'] ?? [],
            'petty_cash' => $m['petty_cash'] ?? [],
            'documents' => Db::all('SELECT type, no, party, doc_date, amount FROM documents ORDER BY doc_date DESC, id DESC LIMIT 8'),
        ];
    }
}
