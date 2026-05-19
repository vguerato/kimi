import { useState } from 'react';
import { TextField, Label, InputGroup, Button, Description } from '@heroui/react';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';

interface PasswordFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  description?: string;
  onChange: (value: string) => void;
}

export function PasswordField({ label, value, placeholder, description, onChange }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TextField className="flex flex-col gap-1.5 w-full">
      <Label>{label}</Label>
      <InputGroup fullWidth>
        <InputGroup.Input
          type={isVisible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
        />
        <InputGroup.Suffix>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label="toggle password visibility"
            onPress={() => setIsVisible(v => !v)}
            className="text-muted hover:text-foreground"
          >
            {isVisible ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      {description && <Description className="text-xs">{description}</Description>}
    </TextField>
  );
}
