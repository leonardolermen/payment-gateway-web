import type { ReactNode } from "react";

type Props = { headers: string[]; children: ReactNode };

// The scroll lives inside the wrapper: a six-column table cannot fit 375px, and letting it widen
// the page would scroll the whole panel sideways.
export function Table({ headers, children }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {headers.map((header) => (
              <th
                key={header}
                className="px-3 py-2.5 text-[10px] font-medium tracking-wider whitespace-nowrap text-muted uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line [&_td]:h-10 [&_td]:px-3 [&_td]:py-1.5">
          {children}
        </tbody>
      </table>
    </div>
  );
}
