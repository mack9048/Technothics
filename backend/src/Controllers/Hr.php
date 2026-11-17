<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use App\Http;
use App\HttpError;

final class Hr
{
    public static function show(): array
    {
        $m = Db::metric('hr');
        $q = trim((string) ($_GET['q'] ?? ''));
        $staff = $q === ''
            ? Db::all('SELECT * FROM employees ORDER BY id')
            : Db::all('SELECT * FROM employees WHERE name LIKE ? OR role LIKE ? OR phone LIKE ? ORDER BY id', array_fill(0, 3, "%$q%"));

        return [
            'date' => $m['date'] ?? '',
            'stats' => [
                'employees' => $m['employees'] ?? 0,
                'present' => $m['present'] ?? 0,
                'on_leave' => $m['on_leave'] ?? 0,
                'payroll_total' => $m['payroll_total'] ?? 0,
                'payroll_month' => $m['payroll_month'] ?? '',
            ],
            'shift' => $m['shift'] ?? '',
            'depts' => $m['depts'] ?? [],
            'punches' => $m['punches'] ?? [],
            'leaves' => Db::all("SELECT * FROM leaves WHERE status = 'pending' ORDER BY id"),
            'payroll' => $m['payroll'] ?? [],
            'staff' => $staff,
            'incentives' => $m['incentives'] ?? [],
            'documents' => $m['documents'] ?? [],
        ];
    }

    /** PATCH /hr/leaves/{id} {status: approved|rejected} */
    public static function decideLeave(array $p): array
    {
        $status = Http::body()['status'] ?? '';
        if (!in_array($status, ['approved', 'rejected'], true)) {
            throw new HttpError(422, 'status must be approved or rejected');
        }
        if (Db::exec('UPDATE leaves SET status = ? WHERE id = ?', [$status, (int) $p['id']]) === 0) {
            throw new HttpError(404, 'Leave request not found');
        }
        return ['id' => (int) $p['id'], 'status' => $status];
    }

    /** POST /hr/employees {name, role, dept, ...} */
    public static function addEmployee(): array
    {
        $in = Http::body();
        Http::required($in, ['name', 'role', 'dept']);
        $words = preg_split('/\s+/', trim((string) $in['name']));
        $init = strtoupper(count($words) > 1 ? $words[0][0] . $words[1][0] : substr($words[0], 0, 2));
        $row = [
            'name' => trim((string) $in['name']),
            'initials' => $init,
            'role' => $in['role'],
            'dept' => $in['dept'],
            'joined' => date('M Y'),
            'pay_type' => $in['pay_type'] ?? 'Monthly',
            'access' => $in['access'] ?? 'None',
            'phone' => $in['phone'] ?? '',
            'area' => $in['area'] ?? '',
        ];
        $row['id'] = Db::insert('employees', $row);
        return ['employee' => $row];
    }
}
