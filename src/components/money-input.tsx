import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatarMoeda,
  formatarValorMonetarioCampo,
  normalizarDigitacaoMonetaria,
} from "@/lib/moeda";

type Props = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function MoneyInput({ value, onValueChange, className, onBlur, onFocus, ...props }: Props) {
  const [emEdicao, setEmEdicao] = useState(false);
  const exibido = useMemo(() => {
    if (!value) return "";
    if (emEdicao) return formatarValorMonetarioCampo(value);
    return formatarMoeda(value).replace(/^R\$\s*/, "");
  }, [emEdicao, value]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        R$
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        value={exibido}
        onChange={(event) => onValueChange(normalizarDigitacaoMonetaria(event.target.value))}
        onFocus={(event) => {
          if (!props.readOnly && !props.disabled) setEmEdicao(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          if (value && value.endsWith(".")) onValueChange(value.slice(0, -1));
          setEmEdicao(false);
          onBlur?.(event);
        }}
        className={cn("pl-10 tabular-nums", className)}
        placeholder={props.placeholder ?? "0,00"}
      />
    </div>
  );
}
