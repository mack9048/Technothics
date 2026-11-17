<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Db;
use App\Http;
use App\HttpError;

final class Inventory
{
    public static function show(): array
    {
        $cat = $_GET['category'] ?? 'All';
        $items = $cat === 'All'
            ? Db::all('SELECT * FROM items ORDER BY (on_hand < reorder_level) DESC, id')
            : Db::all('SELECT * FROM items WHERE category = ? ORDER BY (on_hand < reorder_level) DESC, id', [$cat]);
        $m = Db::metric('inventory');
        $vans = Db::all('SELECT * FROM vans ORDER BY id');

        return [
            'stats' => [
                'skus' => $m['skus'] ?? count($items),
                'stock_value' => $m['stock_value'] ?? 0,
                'van_value' => array_sum(array_map(fn ($v) => (float) $v['value'], $vans)),
            ],
            'categories' => array_merge(['All'], array_column(Db::all('SELECT DISTINCT category FROM items ORDER BY category'), 'category')),
            'items' => array_map(fn ($i) => [
                'id' => (int) $i['id'],
                'name' => $i['name'],
                'category' => $i['category'],
                'bin' => $i['bin'],
                'on_hand' => (int) $i['on_hand'],
                'reserved' => (int) $i['reserved'],
                'in_vans' => (int) $i['in_vans'],
                'reorder_level' => (int) $i['reorder_level'],
                'status' => (int) $i['on_hand'] < (int) $i['reorder_level'] ? 'Re-order' : ((int) $i['watch'] ? 'Watch' : 'OK'),
            ], $items),
            'reorder' => array_map(fn ($i) => [
                'id' => (int) $i['id'],
                'name' => $i['name'],
                'supplier' => $i['supplier'],
                'price' => (float) $i['last_price'],
                'qty' => (int) $i['reorder_qty'],
            ], Db::all('SELECT * FROM items WHERE on_hand < reorder_level ORDER BY id')),
            'technicians' => Db::all("SELECT name, area FROM employees WHERE role = 'Field technician' ORDER BY id"),
            'vans' => $vans,
        ];
    }

    /** POST /purchase-orders {item_ids: int[]} — one PO line per item at its re-order quantity and last price. */
    public static function createPurchaseOrders(): array
    {
        $ids = array_map('intval', (array) (Http::body()['item_ids'] ?? []));
        if (!$ids) {
            throw new HttpError(422, 'Pick at least one item');
        }
        $created = [];
        $seq = (int) Db::one('SELECT COUNT(*) AS n FROM purchase_orders')['n'];
        foreach ($ids as $id) {
            $i = Db::one('SELECT * FROM items WHERE id = ?', [$id]);
            if (!$i) {
                continue;
            }
            $po = [
                'no' => sprintf('PO-%s-%03d', date('ym'), ++$seq),
                'item_id' => $id,
                'supplier' => $i['supplier'],
                'qty' => (int) $i['reorder_qty'],
                'price' => (float) $i['last_price'],
            ];
            Db::insert('purchase_orders', $po);
            $created[] = $po + ['item' => $i['name']];
        }
        return ['purchase_orders' => $created];
    }

    /** POST /vans/issue {tech} — move the standard kit from warehouse to the technician's van. */
    public static function issueKit(): array
    {
        $in = Http::body();
        Http::required($in, ['tech']);
        $kit = ['12V DC fan' => 2, 'IRFZ44N MOSFET' => 4, 'Charging relay 30A' => 2];
        $van = Db::one('SELECT * FROM vans WHERE tech = ?', [$in['tech']]) ?? throw new HttpError(404, 'No van for that technician');
        $value = 0;
        $count = 0;
        foreach ($kit as $name => $qty) {
            $i = Db::one('SELECT * FROM items WHERE name = ?', [$name]);
            if (!$i || (int) $i['on_hand'] < $qty) {
                continue;
            }
            Db::exec('UPDATE items SET on_hand = on_hand - ?, in_vans = in_vans + ? WHERE id = ?', [$qty, $qty, $i['id']]);
            $value += $qty * (float) $i['last_price'];
            $count += $qty;
        }
        Db::exec('UPDATE vans SET items = items + ?, value = value + ? WHERE id = ?', [$count, $value, $van['id']]);
        return ['van' => Db::one('SELECT * FROM vans WHERE id = ?', [$van['id']]), 'issued_items' => $count];
    }
}
