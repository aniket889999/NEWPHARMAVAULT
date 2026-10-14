import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  totalPrice: () => number;
  totalItems: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => {
        const existingItem = state.items.find(i => i.id === item.id);
        if (existingItem) {
          return { items: state.items.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) };
        }
        return { items: [...state.items, { ...item, qty: 1 }] };
      }),
      removeItem: (id) => set((state) => ({
        items: state.items.filter(i => i.id !== id)
      })),
      updateQty: (id, qty) => set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, qty } : i)
      })),
      clearCart: () => set({ items: [] }),
      totalPrice: () => get().items.reduce((total, item) => total + item.price * item.qty, 0),
      totalItems: () => get().items.reduce((total, item) => total + item.qty, 0)
    }),
    { name: 'pharmavault-cart' }
  )
);
