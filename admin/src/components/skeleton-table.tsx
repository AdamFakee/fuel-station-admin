'use client';

import React from "react";

export const TicketTableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <div className="w-full animate-pulse">
      {/* Filter Input Skeleton */}
      <div className="flex md:flex-row flex-col items-center py-6 pt-0 gap-3">
        <div className="relative w-full">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10 w-4 h-4 bg-gray-300 rounded-full" />
          <div className="h-10 bg-gray-200 rounded-md pl-9" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-6 py-3">
                  <div className="h-4 w-24 bg-gray-300 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx} className="border-t">
                {Array.from({ length: cols }).map((_, cIdx) => (
                  <td key={cIdx} className="px-6 py-3">
                    <div className="h-4 w-full bg-gray-200 rounded" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-muted-foreground flex-1 text-sm h-4 w-48 bg-gray-200 rounded" />
        <div className="space-x-2 flex">
          <div className="h-8 w-20 bg-gray-300 rounded" />
          <div className="h-8 w-20 bg-gray-300 rounded" />
        </div>
      </div>
    </div>
  );
};

export const TableRowSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-t animate-pulse">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="px-6 py-4">
              <div className="h-4 w-full bg-muted rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export const SkeletonTable = TicketTableSkeleton;
