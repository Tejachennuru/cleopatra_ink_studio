import { create } from "zustand";

export interface DesignVariant {
  id: string;
  gradient: string;
  patternType: "mandala" | "geometric" | "tribal" | "floral" | "dark" | "minimal" | "japanese" | "biomech";
  styleName: string;
}

interface AppState {
  // Customer info
  sessionId: string;
  customerName: string;
  customerPhone: string;

  // Design step
  tattooStyle: string;
  tattooDescription: string;
  referenceImages: string[];
  generatedDesigns: DesignVariant[];
  selectedDesigns: DesignVariant[];   // multi-select for refinement
  selectedDesign: DesignVariant | null; // final approved single design
  refinementText: string;
  isGenerating: boolean;
  iterationCount: number;

  // Placement step
  placementText: string;
  bodyPhoto: string | null;
  finalComposite: string | null;
  isGeneratingPlacement: boolean;

  // Actions
  startSession: (name: string, phone: string) => string;
  setTattooStyle: (style: string) => void;
  setTattooDescription: (text: string) => void;
  addReferenceImage: (url: string) => void;
  removeReferenceImage: (index: number) => void;
  generateDesigns: () => void;
  finishGenerating: (designs: DesignVariant[]) => void;
  toggleDesignSelection: (design: DesignVariant) => void;
  clearDesignSelection: () => void;
  selectDesign: (design: DesignVariant) => void;
  setRefinementText: (text: string) => void;
  setPlacementText: (text: string) => void;
  setBodyPhoto: (url: string | null) => void;
  generatePlacement: () => void;
  finishPlacement: (composite: string) => void;
  reset: () => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

const defaultState = {
  sessionId: "",
  customerName: "",
  customerPhone: "",
  tattooStyle: "",
  tattooDescription: "",
  referenceImages: [],
  generatedDesigns: [],
  selectedDesigns: [],
  selectedDesign: null,
  refinementText: "",
  isGenerating: false,
  iterationCount: 0,
  placementText: "",
  bodyPhoto: null,
  finalComposite: null,
  isGeneratingPlacement: false,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...defaultState,

  startSession: (name, phone) => {
    const id = generateId();
    set({ sessionId: id, customerName: name, customerPhone: phone });
    return id;
  },

  setTattooDescription: (text) => set({ tattooDescription: text }),

  addReferenceImage: (url) =>
    set((s) => ({
      referenceImages: s.referenceImages.length < 5 ? [...s.referenceImages, url] : s.referenceImages,
    })),

  removeReferenceImage: (index) =>
    set((s) => ({ referenceImages: s.referenceImages.filter((_, i) => i !== index) })),

  setTattooStyle: (style) => set({ tattooStyle: style }),

  generateDesigns: () =>
    set((s) => ({ isGenerating: true, iterationCount: s.iterationCount + 1 })),

  finishGenerating: (designs) =>
    set({ isGenerating: false, generatedDesigns: designs, selectedDesigns: [], refinementText: "" }),

  toggleDesignSelection: (design) =>
    set((s) => {
      const alreadySelected = s.selectedDesigns.some((d) => d.id === design.id);
      if (alreadySelected) {
        return { selectedDesigns: s.selectedDesigns.filter((d) => d.id !== design.id) };
      }
      if (s.selectedDesigns.length >= 4) return {};
      return { selectedDesigns: [...s.selectedDesigns, design] };
    }),

  clearDesignSelection: () => set({ selectedDesigns: [] }),

  selectDesign: (design) => set({ selectedDesign: design }),

  setRefinementText: (text) => set({ refinementText: text }),

  setPlacementText: (text) => set({ placementText: text }),

  setBodyPhoto: (url) => set({ bodyPhoto: url }),

  generatePlacement: () => set({ isGeneratingPlacement: true }),

  finishPlacement: (composite) =>
    set({ isGeneratingPlacement: false, finalComposite: composite }),

  reset: () => set(defaultState),
}));
