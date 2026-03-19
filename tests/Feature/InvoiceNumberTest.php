<?php

namespace Tests\Feature;

use App\Helpers\InvoiceNumber;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceNumberTest extends TestCase
{
    use RefreshDatabase;

    public function test_generates_invoice_number_with_correct_format(): void
    {
        $number = InvoiceNumber::generate();
        $this->assertMatchesRegularExpression('/^INV-\d{8}-\d{4}$/', $number);
    }

    public function test_first_number_of_day_ends_with_0001(): void
    {
        $number = InvoiceNumber::generate();
        $this->assertStringEndsWith('-0001', $number);
    }

    public function test_second_call_increments_sequence(): void
    {
        $first = InvoiceNumber::generate();
        $second = InvoiceNumber::generate();
        $this->assertStringEndsWith('-0001', $first);
        $this->assertStringEndsWith('-0002', $second);
    }

    public function test_uses_todays_date_in_number(): void
    {
        $today = now()->format('Ymd');
        $number = InvoiceNumber::generate();
        $this->assertStringContainsString("INV-{$today}-", $number);
    }
}
