import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mmkvStorage } from '../utils/storage';
import { Assignment } from '../services/api';

interface JobState {
    assignments: Assignment[];
    activeAssignmentId: string | null;
    lastSyncTime: string | null;

    // Actions
    setAssignments: (assignments: Assignment[]) => void;
    addAssignment: (assignment: Assignment) => void;
    updateAssignmentStatus: (id: string, status: Assignment['status']) => void;
    setActiveAssignment: (id: string | null) => void;
    clearAssignments: () => void;
}

export const useJobStore = create<JobState>()(
    persist(
        (set, get) => ({
            assignments: [],
            activeAssignmentId: null,
            lastSyncTime: null,

            setAssignments: (newAssignments) => set({
                assignments: newAssignments,
                lastSyncTime: new Date().toISOString()
            }),

            addAssignment: (assignment) => set((state) => ({
                assignments: [...state.assignments, assignment]
            })),

            updateAssignmentStatus: (id, status) => set((state) => ({
                assignments: state.assignments.map(a =>
                    a.assignment_id === id ? { ...a, status } : a
                )
            })),

            setActiveAssignment: (id) => set({ activeAssignmentId: id }),

            clearAssignments: () => set({
                assignments: [],
                activeAssignmentId: null,
                lastSyncTime: null
            })
        }),
        {
            name: 'job-storage',
            storage: createJSONStorage(() => mmkvStorage),
        }
    )
);
