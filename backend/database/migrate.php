<?php
declare(strict_types=1);

/**
 * Creates the tables and loads the sample data from seed.json.
 *   php database/migrate.php          create tables if missing, seed if empty
 *   php database/migrate.php --fresh  drop everything and reseed
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use App\Db;

$fresh = in_array('--fresh', $argv ?? [], true);
$pdo = Db::pdo();
$mysql = Db::driver() === 'mysql';
$id = $mysql ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
$text = $mysql ? 'TEXT' : 'TEXT';
$str = 'VARCHAR(191)';
$money = 'DECIMAL(14,2)';
$now = $mysql ? 'DATETIME DEFAULT CURRENT_TIMESTAMP' : "TEXT DEFAULT (datetime('now'))";
$suffix = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';

$tables = [
    'models' => "id $id, code $str NOT NULL, name $str NOT NULL UNIQUE, dealer_price $money NOT NULL DEFAULT 0,
        labour $money NOT NULL DEFAULT 0, overhead $money NOT NULL DEFAULT 0, units_month INT NOT NULL DEFAULT 0",
    'items' => "id $id, name $str NOT NULL UNIQUE, category $str NOT NULL, bin $str, on_hand INT NOT NULL DEFAULT 0,
        reserved INT NOT NULL DEFAULT 0, in_vans INT NOT NULL DEFAULT 0, reorder_level INT NOT NULL DEFAULT 0,
        supplier $str, last_price $money NOT NULL DEFAULT 0, reorder_qty INT NOT NULL DEFAULT 0, watch INT NOT NULL DEFAULT 0,
        sale_price $money NOT NULL DEFAULT 0, hsn VARCHAR(16)",
    'bom_lines' => "id $id, model_id INT NOT NULL, component $str NOT NULL, spec $str, qty $str NOT NULL,
        unit_price $money NOT NULL DEFAULT 0, item_id INT NULL, per_unit INT NOT NULL DEFAULT 1, cover_units INT NULL",
    'batches' => "id $id, code $str NOT NULL UNIQUE, model_id INT NOT NULL, qty INT NOT NULL, stage $str NOT NULL,
        serial_from $str, serial_to $str, progress INT NOT NULL DEFAULT 0, created_at $now",
    'serials' => "id $id, serial $str NOT NULL UNIQUE, model_id INT NOT NULL, batch $str, sold_on DATE NULL,
        warranty_till DATE NULL, customer $str, history $str",
    'employees' => "id $id, name $str NOT NULL, initials VARCHAR(4) NOT NULL, role $str, dept $str, joined $str,
        pay_type $str, access $str, phone $str, area $str",
    'tickets' => "id $id, code $str NOT NULL UNIQUE, kind VARCHAR(16) NOT NULL, customer $str NOT NULL, product $str,
        serial $str NULL, tag $str, stage $str, tech $str NULL, registered_on DATE, phone $str, fault $text NULL,
        parts $str NULL, action $str NULL, address $str NULL, approved INT NOT NULL DEFAULT 0,
        complaint $text NULL, inspection $text NULL, proforma_no $str NULL, proforma_sent $str NULL, created_at $now",
    'leaves' => "id $id, employee $str NOT NULL, label $str, type $str, dates $str, balance $str,
        status VARCHAR(16) NOT NULL DEFAULT 'pending'",
    'documents' => "id $id, type $str NOT NULL, no $str NOT NULL, party $str, doc_date DATE, amount $money NOT NULL DEFAULT 0",
    'vans' => "id $id, tech $str NOT NULL, items INT NOT NULL DEFAULT 0, value $money NOT NULL DEFAULT 0,
        used_today $str, reconciled $str",
    'purchase_orders' => "id $id, no $str NOT NULL, item_id INT NOT NULL, supplier $str, qty INT NOT NULL,
        price $money NOT NULL DEFAULT 0, status VARCHAR(16) NOT NULL DEFAULT 'open', created_at $now",
    'job_reports' => "id $id, ticket_code $str NOT NULL, kind $str NOT NULL, payload $text, created_at $now",
    'payments' => "id $id, ticket_code $str, invoice_no $str, method VARCHAR(16) NOT NULL, amount $money NOT NULL,
        created_at $now",
    'metrics' => "name VARCHAR(64) PRIMARY KEY, value $text NOT NULL",
];

if ($fresh) {
    foreach (array_reverse(array_keys($tables)) as $t) {
        $pdo->exec("DROP TABLE IF EXISTS $t");
    }
}
foreach ($tables as $t => $cols) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS $t ($cols)$suffix");
}

if ((int) Db::one('SELECT COUNT(*) AS n FROM models')['n'] > 0) {
    echo "Tables ready (already seeded).\n";
    exit(0);
}

$seed = json_decode((string) file_get_contents(__DIR__ . '/seed.json'), true, flags: JSON_THROW_ON_ERROR);
$pdo->beginTransaction();

$modelIds = [];
foreach ($seed['models'] as $m) {
    $modelIds[$m['name']] = Db::insert('models', $m);
}
$itemIds = [];
foreach ($seed['items'] as $i) {
    $i['watch'] = $i['watch'] ? 1 : 0;
    $itemIds[$i['name']] = Db::insert('items', $i);
}
foreach ($seed['bom'] as $model => $lines) {
    foreach ($lines as $l) {
        Db::insert('bom_lines', [
            'model_id' => $modelIds[$model],
            'component' => $l['component'],
            'spec' => $l['spec'],
            'qty' => $l['qty'],
            'unit_price' => $l['unit_price'],
            'item_id' => $l['item'] ? $itemIds[$l['item']] : null,
            'per_unit' => $l['per_unit'],
            'cover_units' => $l['cover'] ?? null,
        ]);
    }
}
foreach ($seed['batches'] as $b) {
    $b['model_id'] = $modelIds[$b['model']];
    unset($b['model']);
    Db::insert('batches', $b);
}
foreach ($seed['serials'] as $s) {
    $s['model_id'] = $modelIds[$s['model']];
    unset($s['model']);
    Db::insert('serials', $s);
}
foreach (['employees', 'tickets', 'leaves', 'documents', 'vans'] as $t) {
    foreach ($seed[$t] as $row) {
        Db::insert($t, $row);
    }
}
foreach ($seed['metrics'] as $name => $value) {
    Db::insert('metrics', ['name' => $name, 'value' => json_encode($value, JSON_UNESCAPED_UNICODE)]);
}
$pdo->commit();
echo "Tables created and sample data loaded (" . Db::driver() . ").\n";
