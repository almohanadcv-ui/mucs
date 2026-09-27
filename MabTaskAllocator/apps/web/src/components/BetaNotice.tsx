import {Info} from 'lucide-react';
export function BetaNotice({feature}:{feature:string}) {
 return <div className="beta-notice" role="note"><Info size={17} aria-hidden="true"/><p><strong>{feature} is in beta.</strong> This feature is still being tested. You may encounter bugs or unexpected behavior.</p></div>;
}
