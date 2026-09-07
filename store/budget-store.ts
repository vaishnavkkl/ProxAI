import { create } from 'zustand';

import type { FixedExpenseRow } from '@/services/database';

type BudgetState = {
  salary: number;
  expenses: FixedExpenseRow[];
  replaceAll: (salary: number, expenses: FixedExpenseRow[]) => void;
  setSalary: (salary: number) => void;
  upsertExpense: (expense: FixedExpenseRow) => void;
  removeExpense: (id: string) => void;
};

export const useBudgetStore = create<BudgetState>((set, get) => ({
  salary: 0,
  expenses: [],
  replaceAll: (salary, expenses) => set({ salary, expenses }),
  setSalary: (salary) => set({ salary }),
  upsertExpense: (expense) => {
    const others = get().expenses.filter((item) => item.id !== expense.id);
    set({ expenses: [...others, expense] });
  },
  removeExpense: (id) => set({ expenses: get().expenses.filter((item) => item.id !== id) }),
}));
