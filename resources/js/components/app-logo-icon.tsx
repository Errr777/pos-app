import { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            {/* Vertical stem */}
            <path d="M1 2.5A1.5 1.5 0 012.5 1h2A1.5 1.5 0 016 2.5v19A1.5 1.5 0 014.5 23h-2A1.5 1.5 0 011 21.5V2.5Z" />
            {/* Top bar — arrow/wedge tip, full width */}
            <path d="M5 1H18L22 4.25L18 7.5H5V1Z" />
            {/* Middle bar — shorter arrow tip */}
            <path d="M5 9.5H13.5L16.5 12L13.5 14.5H5V9.5Z" />
            {/* Bottom bar — arrow/wedge tip, full width */}
            <path d="M5 16.5H18L22 19.75L18 23H5V16.5Z" />
        </svg>
    );
}
