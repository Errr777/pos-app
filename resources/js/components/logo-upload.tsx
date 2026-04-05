import { useEffect, useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';

interface LogoUploadProps {
    currentUrl?: string;
    onChange: (file: File | null) => void;
}

export default function LogoUpload({ currentUrl, onChange }: LogoUploadProps) {
    const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return () => {
            if (preview && preview !== currentUrl) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview, currentUrl]);

    function handleFile(file: File | null) {
        if (!file) return;
        const url = URL.createObjectURL(file);
        setPreview(url);
        onChange(file);
    }

    function handleRemove() {
        setPreview(null);
        onChange(null);
        if (inputRef.current) inputRef.current.value = '';
    }

    return (
        <div>
            {preview ? (
                <div className="relative inline-block">
                    <img src={preview} alt="Logo preview" className="h-20 w-auto rounded border object-contain" />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        title="Hapus logo"
                    >
                        <X size={12} />
                    </button>
                </div>
            ) : (
                <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                        ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        handleFile(e.dataTransfer.files[0] ?? null);
                    }}
                >
                    <UploadCloud size={24} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        Seret & lepas gambar, atau <span className="text-primary underline">pilih file</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG maks. 2MB</p>
                </div>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
        </div>
    );
}
