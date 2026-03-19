<?php

namespace App\Console\Commands;

use App\Models\InstallmentPayment;
use App\Models\InstallmentPlan;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class MarkOverdueInstallments extends Command
{
    protected $signature = 'installments:mark-overdue';

    protected $description = 'Mark past-due installment payments as overdue and apply late fees';

    public function handle(): int
    {
        $today = Carbon::today();

        DB::transaction(function () use ($today) {
            $overduePayments = InstallmentPayment::where('status', 'pending')
                ->where('due_date', '<', $today)
                ->with('plan')
                ->get();

            foreach ($overduePayments as $payment) {
                $lateFee = $payment->plan->late_fee_amount ?? 0;
                $payment->update([
                    'status' => 'overdue',
                    'late_fee_applied' => $lateFee,
                ]);
            }

            $planIds = $overduePayments->pluck('installment_plan_id')->unique();
            if ($planIds->isNotEmpty()) {
                InstallmentPlan::whereIn('id', $planIds)
                    ->where('status', 'active')
                    ->update(['status' => 'overdue']);
            }
        });

        $count = InstallmentPayment::where('status', 'overdue')->count();
        $this->info("Done. Total overdue payments: {$count}");

        return Command::SUCCESS;
    }
}
