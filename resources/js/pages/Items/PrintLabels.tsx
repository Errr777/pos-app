import { useEffect, useRef, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

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

type PrintMode = 'barcode' | 'qrcode';

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

function QRLabel({ item }: { item: LabelItem }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current && item.code) {
            QRCode.toCanvas(canvasRef.current, item.code, {
                width: 120,
                margin: 1,
                color: { dark: '#111827', light: '#ffffff' },
            }).catch(() => {});
        }
    }, [item.code]);

    return (
        <div className="label-card label-card-qr">
            <div className="label-name">{item.name}</div>
            {item.category && <div className="label-category">{item.category}</div>}
            <div className="label-qr-wrap">
                <canvas ref={canvasRef} className="label-qr-canvas" />
            </div>
            <div className="label-code">{item.code}</div>
            <div className="label-price">{formatRp(item.price)}</div>
        </div>
    );
}

export default function PrintLabels() {
    const { items } = usePage<PageProps>().props;
    const [mode, setMode] = useState<PrintMode>('barcode');

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
                    .mode-group {
                        display: flex; gap: 0; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden;
                    }
                    .mode-btn {
                        background: white; color: #374151; border: none; border-right: 1px solid #d1d5db;
                        padding: 8px 16px; cursor: pointer; font-size: 13px; font-weight: 500;
                    }
                    .mode-btn:last-child { border-right: none; }
                    .mode-btn.active { background: #4f46e5; color: white; }
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
                .label-qr-wrap { display: flex; justify-content: center; margin: 2mm 0 1mm; }
                .label-qr-canvas { width: 30mm !important; height: 30mm !important; }
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
                <div className="mode-group">
                    <button
                        className={`mode-btn${mode === 'barcode' ? ' active' : ''}`}
                        onClick={() => setMode('barcode')}
                    >
                        Barcode
                    </button>
                    <button
                        className={`mode-btn${mode === 'qrcode' ? ' active' : ''}`}
                        onClick={() => setMode('qrcode')}
                    >
                        QR Code
                    </button>
                </div>
                <button className="back-btn" onClick={() => window.history.back()}>
                    ← Kembali
                </button>
                <span style={{ color: '#6b7280', fontSize: 13 }}>
                    {items.length} label · A4 · 4 kolom
                </span>
            </div>

            <div className="label-grid">
                {items.map(item =>
                    mode === 'barcode'
                        ? <BarcodeLabel key={item.id} item={item} />
                        : <QRLabel key={item.id} item={item} />
                )}
            </div>
        </>
    );
}
