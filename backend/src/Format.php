<?php
declare(strict_types=1);

namespace App;

/** Indian number / date formatting helpers. */
final class Format
{
    /** 1846200 -> "18,46,200" */
    public static function inr(float|int $n, int $decimals = 0): string
    {
        $neg = $n < 0;
        $n = abs($n);
        $whole = (string) (int) floor($n);
        $frac = $decimals > 0 ? '.' . substr(number_format($n - floor($n), $decimals, '.', ''), 2) : '';
        if (strlen($whole) > 3) {
            $last3 = substr($whole, -3);
            $rest = substr($whole, 0, -3);
            $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest);
            $whole = $rest . ',' . $last3;
        }
        return ($neg ? '− ' : '') . $whole . $frac;
    }

    /** "2026-11-18" -> "18 Nov" (or "18 Nov 2026" with $year) */
    public static function date(?string $ymd, bool $year = false): string
    {
        if (!$ymd) {
            return '';
        }
        $t = strtotime($ymd);
        return date($year ? 'd M Y' : 'd M', $t);
    }
}
