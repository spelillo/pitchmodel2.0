import { CountControl } from "./CountControl";

interface OutsControlProps {
  active: 0 | 1 | 2;
  onChange: (value: 0 | 1 | 2) => void;
}

const OUTS_VALUES = [0, 1, 2] as const;

export function OutsControl({ active, onChange }: OutsControlProps) {
  return (
    <CountControl
      label="Outs"
      values={OUTS_VALUES}
      active={active}
      onChange={(value) => onChange(value as 0 | 1 | 2)}
    />
  );
}
