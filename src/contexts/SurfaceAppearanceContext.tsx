import { createContext, useContext } from 'react';

export const FlatSurfaceContext = createContext(false);
export const useFlatSurface = () => useContext(FlatSurfaceContext);
