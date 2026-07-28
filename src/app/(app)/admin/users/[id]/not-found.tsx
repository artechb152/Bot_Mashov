import Link from "next/link";
import { buttonClasses } from "@/components/ui";

export default function AdminUserNotFound() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <h2 className="text-lg font-semibold text-ink">המשתמש לא נמצא</h2>
        <p className="mt-1 text-sm text-muted">ייתכן שהמשתמש הוסר או שהקישור שגוי.</p>
        <div className="mt-4 flex justify-center">
          <Link href="/admin/users" className={buttonClasses({ variant: "secondary" })}>
            חזרה לרשימת המשתמשים
          </Link>
        </div>
      </div>
    </div>
  );
}
