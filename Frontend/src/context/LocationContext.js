import React, { createContext, useState, useContext } from 'react';

const LocationContext = createContext();

export function LocationProvider({ children }) {
  const [location, setLocation] = useState({
    postcode: null,
    label: null,
    lat: null,
    lng: null
  });

  const updateLocation = (postcode, label, lat, lng) => {
    setLocation({ postcode, label, lat, lng });
  };

  return (
    <LocationContext.Provider value={{ location, updateLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export const useLocation = () => useContext(LocationContext);
