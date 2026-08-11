import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ClienteOpcao {
  id: string;
  nome: string;
}

interface ClienteComboboxProps {
  clientes: ClienteOpcao[];
  value: string;
  onValueChange: (clienteId: string) => void;
  disabled?: boolean;
}

export function ClienteCombobox({
  clientes,
  value,
  onValueChange,
  disabled,
}: ClienteComboboxProps) {
  const [open, setOpen] = useState(false);
  const selecionado = clientes.find((cliente) => cliente.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Selecionar cliente"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selecionado?.nome ?? "Pesquise ou selecione"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Pesquisar cliente..." autoFocus />
          <CommandList className="max-h-72 overscroll-contain">
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup heading={`${clientes.length} cliente(s)`}>
              {clientes.map((cliente) => (
                <CommandItem
                  key={cliente.id}
                  value={`${cliente.nome} ${cliente.id}`}
                  onSelect={() => {
                    onValueChange(cliente.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4", value === cliente.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{cliente.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
