import { useEffect, useRef, useState } from "react";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Campo de data em dd/mm/aaaa.
 *
 * O <input type="date"> nativo é formatado pelo idioma do navegador, não pelo
 * lang do documento — num Chrome em inglês ele aparece como mm/dd/yyyy. Este
 * componente controla a exibição, garantindo dd/mm/aaaa em qualquer navegador,
 * enquanto o valor trafega sempre em ISO (aaaa-mm-dd), igual ao campo nativo.
 */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function isoParaBr(iso?: string | null): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "";
}

export function brParaIso(texto: string): string {
  const digitos = texto.replace(/\D/g, "");
  if (digitos.length !== 8) return "";
  const dia = Number(digitos.slice(0, 2));
  const mes = Number(digitos.slice(2, 4));
  const ano = Number(digitos.slice(4, 8));
  const data = new Date(ano, mes - 1, dia);
  // Descarta datas inexistentes (31/02, mês 13...) pelo round-trip.
  if (data.getDate() !== dia || data.getMonth() + 1 !== mes || data.getFullYear() !== ano) {
    return "";
  }
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

function mascarar(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

interface DateFieldProps {
  id?: string;
  value: string;
  onValueChange: (iso: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
}

export function DateField({
  id,
  value,
  onValueChange,
  disabled,
  required,
  className,
  placeholder = "dd/mm/aaaa",
  ...props
}: DateFieldProps) {
  const [texto, setTexto] = useState(() => isoParaBr(value));
  const [aberto, setAberto] = useState(false);
  const ultimoIso = useRef(value);

  useEffect(() => {
    if (value === ultimoIso.current) return;
    ultimoIso.current = value;
    setTexto(isoParaBr(value));
  }, [value]);

  function emitir(iso: string) {
    ultimoIso.current = iso;
    onValueChange(iso);
  }

  function aoDigitar(entrada: string) {
    const novoTexto = mascarar(entrada);
    setTexto(novoTexto);
    emitir(brParaIso(novoTexto));
  }

  function aoSelecionar(data?: Date) {
    if (!data) return;
    const iso = `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
    setTexto(isoParaBr(iso));
    emitir(iso);
    setAberto(false);
  }

  const selecionada = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <div className={cn("relative", className)}>
      <Input
        {...props}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder={placeholder}
        value={texto}
        disabled={disabled}
        required={required}
        onChange={(event) => aoDigitar(event.target.value)}
        className="pr-10"
      />
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Abrir calendário"
            className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selecionada}
            defaultMonth={selecionada}
            onSelect={aoSelecionar}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Data/hora local (aaaa-mm-ddThh:mm), sem passar por UTC como o toISOString(). */
export function dataHoraLocal(data: Date): string {
  return (
    `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}` +
    `T${pad(data.getHours())}:${pad(data.getMinutes())}`
  );
}

function separarDataHora(valor: string): [string, string] {
  const partes = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(valor ?? "");
  return partes ? [partes[1], partes[2]] : ["", ""];
}

interface DateTimeFieldProps {
  id?: string;
  value: string;
  onValueChange: (valor: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/** Equivalente ao <input type="datetime-local">, com a data em dd/mm/aaaa. */
export function DateTimeField({
  id,
  value,
  onValueChange,
  disabled,
  required,
  className,
}: DateTimeFieldProps) {
  const [dataAtual, horaAtual] = separarDataHora(value);
  const [hora, setHora] = useState(horaAtual || "00:00");
  const ultimoValor = useRef(value);

  useEffect(() => {
    if (value === ultimoValor.current) return;
    ultimoValor.current = value;
    setHora(separarDataHora(value)[1] || "00:00");
  }, [value]);

  function emitir(data: string, novaHora: string) {
    const novo = data ? `${data}T${novaHora || "00:00"}` : "";
    ultimoValor.current = novo;
    onValueChange(novo);
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <DateField
        id={id}
        value={dataAtual}
        onValueChange={(iso) => emitir(iso, hora)}
        disabled={disabled}
        required={required}
        className="flex-1"
      />
      <Input
        type="time"
        value={hora}
        disabled={disabled}
        required={required}
        aria-label="Hora"
        className="w-28"
        onChange={(event) => {
          setHora(event.target.value);
          emitir(dataAtual, event.target.value);
        }}
      />
    </div>
  );
}
