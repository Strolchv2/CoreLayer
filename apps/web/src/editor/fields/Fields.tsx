import { isValidPartialDate, parseDateInput, toDateInputString, type DateFormat } from '@cv-studio/shared';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { FormField } from '../../components/ui/FormField';
import { IconButton } from '../../components/ui/IconButton';
import { Input, Textarea } from '../../components/ui/Input';
import { useT } from '../../i18n';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  action?: ReactNode;
  className?: string;
}

export function TextField({ label, value, onChange, error, hint, required, action, className, ...rest }: TextFieldProps) {
  return (
    <FormField label={label} error={error} hint={hint} required={required} action={action} className={className}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </FormField>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  rows = 3,
  maxLength = 5000,
  action,
  className,
  placeholder,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  rows?: number;
  maxLength?: number;
  action?: ReactNode;
  className?: string;
  placeholder?: string;
}) {
  const t = useT();
  const tooLong = value.length > maxLength;
  return (
    <FormField label={label} hint={hint} error={tooLong ? t('validation.too_long') : null} action={action} className={className}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength + 500} placeholder={placeholder} />
    </FormField>
  );
}

/**
 * Datumseingabe mit freier Schreibweise (2022, 01/2022, 15.01.2022).
 * Nur gültige Werte werden übernommen; ungültige Eingaben werden markiert.
 */
export function DateField({
  label,
  value,
  onChange,
  format,
  disabled,
  className,
  error: externalError,
  action,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  format: DateFormat;
  disabled?: boolean;
  className?: string;
  error?: string | null;
  action?: ReactNode;
}) {
  const t = useT();
  const [text, setText] = useState(() => toDateInputString(value, format));
  const [invalid, setInvalid] = useState(false);

  // Externe Änderungen (z. B. Wiederherstellung) übernehmen
  useEffect(() => {
    const parsed = parseDateInput(text);
    if (parsed !== value) {
      setText(toDateInputString(value, format));
      setInvalid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, format]);

  const handle = (next: string) => {
    setText(next);
    const parsed = parseDateInput(next);
    if (parsed !== null && isValidPartialDate(parsed)) {
      setInvalid(false);
      if (parsed !== value) onChange(parsed);
    } else {
      setInvalid(next.trim().length >= 4);
    }
  };

  return (
    <FormField label={label} error={invalid ? t('validation.invalid_date') : externalError} className={className} action={action}>
      <Input
        value={disabled ? '' : text}
        onChange={(e) => handle(e.target.value)}
        onBlur={() => setInvalid(text.trim() !== '' && parseDateInput(text) === null)}
        placeholder={disabled ? t('field.currentGeneric') : t('editor.date.placeholder')}
        inputMode="numeric"
        disabled={disabled}
        maxLength={10}
      />
    </FormField>
  );
}

export function VisibilityToggle({ visible, onToggle, labelShow, labelHide, size = 'sm' }: { visible: boolean; onToggle: () => void; labelShow: string; labelHide: string; size?: 'sm' | 'md' }) {
  return (
    <IconButton label={visible ? labelHide : labelShow} onClick={onToggle} size={size} className={visible ? '' : 'text-muted-foreground/50'} aria-pressed={!visible}>
      {visible ? <Eye /> : <EyeOff />}
    </IconButton>
  );
}

export function FieldGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const map = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3' };
  return <div className={`grid gap-3 ${map[cols]}`}>{children}</div>;
}
