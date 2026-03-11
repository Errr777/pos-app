import { useEffect, useRef } from 'react';
import { Head, usePage } from '@inertiajs/react';
import JsBarcode from 'jsbarcode';

interface LabelItem {
    id: number;
    name: string;
    code: string;
    price: number;
    category: string | null;
}

interface PageProps {
    items: LabelItem[];
    [key: string]: unknown;
}

function formatRp(n: number) {
    return 'Rp ' + n.toLocaleString('id-ID');
}

function BarcodeLabel({ item }: { item: LabelItem }) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current && item.code) {
            try {
                JsBarcode(svgRef.current, item.code, {
                    format: 'CODE128',
                    width: 1.5,
                    height: 40,
                    displayValue: false,
                    margin: 0,
                });
            } catch {
                // invalid barcode value — skip
            }
        }
    }, [item.code]);

    return (
        <div className="label-card">
            <div className="label-name">{item.name}</div>
            {item.category && <div className="label-category">{item.category}</div>}
            <svg ref={svgRef} className="label-barcode" />
            <div className="label-code">{item.code}</div>
            <div className="label-price">{formatRp(item.price)}</div>
        </div>
    );
}

export default function PrintLabels() {
    const { items } = usePage<PageProps>().props;

    useEffect(() => {
        const t = setTimeout(() => window.print(), 800);
        return () => clearTimeout(t);
    }, []);

    return (
        <>
            <Head title="Print Labels" />
            <style>{`
                @media screen {
                    body { background: #f1f5f9; padding: 24px; font-family: sans-serif; }
                    .print-controls {
                        display: flex; gap: 12px; margin-bottom: 24px; align-items: center;
                    }
                    .print-btn {
                        background: #4f46e5; color: white; border: none;
                        padding: 8px 20px; border-radius: 8px; cursor: pointer;
                        font-size: 14px; font-weight: 600;
                    }
                    .print-btn:hover { background: #4338ca; }
                    .back-btn {
                        background: white; color: #374151; border: 1px solid #d1d5db;
                        padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px;
                    }
                    .label-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 62mm);
                        gap: 4mm;
                    }
                }
                @media print {
                    .print-controls { display: none !important; }
                    body { margin: 0; padding: 4mm; background: white; }
                    .label-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 62mm);
                        gap: 2mm;
                    }
                    @page { size: A4; margin: 8mm; }
                }
                .label-card {
                    width: 60mm; border: 1px solid #e5e7eb; border-radius: 4px;
                    padding: 3mm 4mm; background: white; font-family: sans-serif;
                    page-break-inside: avoid; box-sizing: border-box;
                }
                .label-name {
                    font-size: 9pt; font-weight: 700; color: #111827;
                    line-height: 1.3; max-height: 2.6em; overflow: hidden;
                }
                .label-category { font-size: 7pt; color: #6b7280; margin-top: 1mm; }
                .label-barcode { width: 100%; height: auto; display: block; margin: 2mm 0 1mm; }
                .label-code { font-size: 7pt; font-family: monospace; color: #374151; text-align: center; letter-spacing: 0.5px; }
                .label-price {
                    font-size: 11pt; font-weight: 800; color: #1d4ed8;
                    text-align: center; margin-top: 1.5mm;
                    border-top: 1px solid #e5e7eb; padding-top: 1.5mm;
                }
            `}</style>

            <div className="print-controls">
                <button className="print-btn" onClick={() => window.print()}>
                    🖨 Cetak Label
                </button>
                <button className="back-btn" onClick={() => window.history.back()}>
                    ← Kembali
                </button>
                <span style={{ color: '#6b7280', fontSize: 13 }}>
                    {items.length} label · A4 · 4 kolom
                </span>
            </div>

            <div className="label-grid">
                {items.map(item => (
                    <BarcodeLabel key={item.id} item={item} />
                ))}
            </div>
        </>
    );
}
