import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DatePickerInputProps {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function toISO(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDisplay(value: string): string {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const START_MONTH = new Date(2020, 0);
const END_MONTH   = new Date(new Date().getFullYear() + 5, 11);

export function DatePickerInput({
    value,
    onChange,
    placeholder = 'Pilih tanggal',
    className,
    disabled,
}: DatePickerInputProps) {
    const [open, setOpen] = useState(false);
    const selected = value ? new Date(value + 'T00:00:00') : undefined;
    const defaultMonth = selected ?? new Date();

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        'w-full justify-start text-left font-normal h-10',
                        !value && 'text-muted-foreground',
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {value ? formatDisplay(value) : placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selected}
                    defaultMonth={defaultMonth}
                    captionLayout="dropdown"
                    startMonth={START_MONTH}
                    endMonth={END_MONTH}
                    onSelect={(date) => {
                        if (date) {
                            onChange(toISO(date));
                            setOpen(false);
                        }
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}

// Compact inline version for filter rows (matches height of small inputs)
export function DatePickerFilter({
    value,
    onChange,
    placeholder = 'Tanggal',
    className,
}: DatePickerInputProps) {
    const [open, setOpen] = useState(false);
    const selected = value ? new Date(value + 'T00:00:00') : undefined;
    const defaultMonth = selected ?? new Date();

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        'h-9 justify-start text-left font-normal text-sm px-3',
                        !value && 'text-muted-foreground',
                        className
                    )}
                >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    {value ? formatDisplay(value) : placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selected}
                    defaultMonth={defaultMonth}
                    captionLayout="dropdown"
                    startMonth={START_MONTH}
                    endMonth={END_MONTH}
                    onSelect={(date) => {
                        if (date) {
                            onChange(toISO(date));
                            setOpen(false);
                        }
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}
