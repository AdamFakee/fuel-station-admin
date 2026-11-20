'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LockOpenIcon } from "@heroicons/react/24/outline";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

interface IConfirmDelete {
  open: boolean;
  label?: string;
  title: string;
  onClose: () => void;
  onAction: () => void;
}

const ConfirmDelete: React.FC<IConfirmDelete> = ({
  open,
  label = "Xác nhận xóa?",
  title,
  onClose,
  onAction,
}) => {
  // Zod schema validate mã xác nhận
  const ConfirmSchema = z.object({
    code: z
      .string()
      .nonempty("Bạn phải nhập mã xác nhận!")
      .refine((val) => val.trim().toUpperCase() === "XACNHAN", {
        message: "Mã xác nhận không đúng!",
      }),
  });

  const form = useForm<{ code: string }>({
    resolver: zodResolver(ConfirmSchema),
    defaultValues: { code: "" },
  });

  const handleSubmit = () => {
    onAction();
    form.reset();
  };

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl py-8">
        <DialogHeader>
          <div className="flex justify-center pb-2">
            <div className="p-3 rounded-3xl border border-border/80 shadow">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
              >
                <path
                  d="M26 26H22V16H26M26 34H22V30H26M36 4H20L8 16V40C8 40.5253 8.10346 41.0454 8.30448 41.5307C8.5055 42.016 8.80014 42.457 9.17157 42.8284C9.54301 43.1999 9.98396 43.4945 10.4693 43.6955C10.9546 43.8965 11.4747 44 12 44H36C36.5253 44 37.0454 43.8965 37.5307 43.6955C38.016 43.4945 38.457 43.1999 38.8284 42.8284C39.1999 42.457 39.4945 42.016 39.6955 41.5307C39.8965 41.0453 40 40.5253 40 40V8C40 7.47471 39.8965 6.95457 39.6955 6.46927C39.4945 5.98396 39.1999 5.54301 38.8284 5.17157C38.457 4.80014 38.016 4.5055 37.5307 4.30448C37.0454 4.10346 36.5253 4 36 4Z"
                  fill="#EF4444"
                />
              </svg>
            </div>
          </div>
          <DialogTitle className="text-destructive/100 md:text-[28px] text-[22px] font-bold text-center">
            {label}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground md:text-xl text-base text-center">
            {title}
            <br />
            Nhập mã <span className="font-bold">XACNHAN</span> để xóa
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="grid gap-4 mt-3"
          >
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Nhập mã"
                      autoFocus
                      {...field}
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                className="w-full mt-2"
              >
                Xác nhận
                <LockOpenIcon className="w-5 h-5 ml-2" />
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDelete;
