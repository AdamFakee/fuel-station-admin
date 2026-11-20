'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import EmptyState from "./empty";
import { MagnifyingGlassPlusIcon } from "@heroicons/react/24/solid";

interface ISelectCustom {
  options: {
    id: string;
    name: string | null;
  }[];
  placeholder?: string;
  optionValue?: string | null;
  setOptionValue: (val: string | null) => void;
}
const SelectCustom: React.FC<ISelectCustom> = ({
  options,
  placeholder,
  optionValue,
  setOptionValue
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("");
  const [valSearch, setValSearch] = useState("");


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onChangeSearch = (e: any) => {
    const { value } = e.target;
    setQuery(value)
  }

  const optionFilters = useMemo(() => {
    return options?.filter((item) => item?.name?.trim()?.toUpperCase()?.includes(valSearch?.trim()?.toUpperCase()))
  }, [options, valSearch])
  useEffect(() => {
    if (!query) return setValSearch("");

    const handler = setTimeout(async () => {
      setValSearch(query);
    }, 500);

    return () => clearTimeout(handler);
  }, [query]);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="w-full">
        <div className="text-secondary-foreground font-semibold text-[13px] md:text-sm xl:text-base w-full md:h-10 h-8.5 px-4 py-2 justify-start inline-flex items-center cursor-pointer gap-2 whitespace-nowrap rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-(--input) bg-white shadow-(--shadow-base) hover:bg-(--accent) hover:text-(--accent-foreground)">
          <p className="w-full text-left">{optionValue ? options?.find((i) => i.id === optionValue)?.name : placeholder}</p>
          <MagnifyingGlassPlusIcon />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <Input value={query} onChange={onChangeSearch} placeholder="Tìm kiếm thông tin" />
        <ScrollArea className="2xl:w-[500px] h-[250px] pt-3">
          {optionFilters?.map((dt) => (
            <div
              className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-(--accent) focus:bg-(--accent) focus:text-(--accent-foreground) data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0"
              key={dt.id}
              onClick={() => {
                setOptionValue(dt?.id);
                setOpen(false);
              }}
            >
              {dt.name}
            </div>
          ))}
          {!optionFilters?.length ? <EmptyState /> : null}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default SelectCustom;