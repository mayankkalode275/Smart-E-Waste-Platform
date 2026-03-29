import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getEWasteCenters } from '../services/api';
import { MdPhone, MdAccessTime, MdLocationOn } from 'react-icons/md';

/** Component to update map center dynamically */
function ChangeView({ center }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

const getMarkerHtml = (num, color) => `
  <div style="background-color: ${color}; color: white; width: 26px; height: 26px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">
    ${num}
  </div>
`;

/**
 * E-Waste Centers Page — Leaflet Map Version
 */
export default function EWasteCenters() {
  const [centers, setCenters] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [userLocation, setUserLocation] = useState({ lat: 19.076, lng: 72.8777 });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); fetchCenters(pos.coords.latitude, pos.coords.longitude); },
        () => { fetchCenters(userLocation.lat, userLocation.lng); }
      );
    } else { fetchCenters(userLocation.lat, userLocation.lng); }
  }, []);

  const fetchCenters = async (lat, lng) => {
    try { const res = await getEWasteCenters(lat, lng); setCenters(res.data.data); }
    catch (err) { console.error('Failed to fetch e-waste centers:', err); }
    finally { setLoadingData(false); }
  };

  const userIcon = L.divIcon({ html: getMarkerHtml('★', '#3b82f6'), className: '', iconSize: [26, 26], iconAnchor: [13, 13] });

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="spinner-premium mx-auto mb-4"></div>
          <p className="text-slate-500 font-semibold tracking-wide">Locating nearest e-waste centers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="page-header flex items-end justify-between">
        <div>
          <h1 className="page-title">E-Waste Centers</h1>
          <p className="page-subtitle">Find certified e-waste recycling locations near you.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Modern List */}
        <div className="lg:col-span-2 space-y-4 max-h-[600px] overflow-y-auto pr-2 pb-2 hide-scrollbar">
          {centers.map((center, i) => (
            <div
              key={i}
              onClick={() => setSelectedCenter(center)}
              className={`premium-card cursor-pointer transition-all ${
                selectedCenter?._id === center._id 
                  ? 'ring-2 ring-emerald-500 shadow-lg scale-[1.02] bg-emerald-50/10' 
                  : 'hover:shadow-lg hover:-translate-y-1'
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3 border-b border-slate-100 pb-3">
                  <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black shrink-0">
                      {i + 1}
                    </div>
                    <span className="line-clamp-1 leading-tight">{center.name}</span>
                  </h3>
                  {center.distance !== undefined && (
                    <span className="text-[11px] font-bold tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md shrink-0 ml-2 uppercase">
                      {center.distance} km
                    </span>
                  )}
                </div>

                <p className="text-sm font-medium text-slate-500 mb-4 flex items-start gap-2">
                  <MdLocationOn size={16} className="shrink-0 mt-0.5 text-rose-400" />
                  <span className="leading-snug">{center.address}</span>
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-600 mb-4 bg-slate-50/80 rounded-xl p-3 border border-slate-100/50">
                  <div className="flex items-center gap-2"><MdPhone size={14} className="text-slate-400" /> <span className="truncate">{center.contact}</span></div>
                  <div className="flex items-center gap-2 text-blue-600"><MdAccessTime size={14} /> <span className="truncate">{center.operatingHours}</span></div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {center.acceptedItems?.map((item, j) => (
                    <span key={j} className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 rounded-md">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {centers.length === 0 && (
            <div className="premium-card p-10 text-center"><p className="text-slate-400 text-sm font-bold tracking-wider uppercase">No centers found locally.</p></div>
          )}
        </div>

        {/* Leaflet Map */}
        <div className="lg:col-span-3 premium-card overflow-hidden p-2 relative" style={{ minHeight: '600px' }}>
          <div className="w-full h-full rounded-xl overflow-hidden relative z-0">
            <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={11} style={{ height: '100%', width: '100%', zIndex: 1 }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://carto.com/">CartoDB</a>' />
              {selectedCenter && <ChangeView center={[selectedCenter.location.lat, selectedCenter.location.lng]} />}
              
              <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                <Popup><strong>Your Location</strong></Popup>
              </Marker>

              {centers.map((center, i) => {
                const isSelected = selectedCenter?._id === center._id;
                const icon = L.divIcon({ html: getMarkerHtml(i + 1, isSelected ? '#F59E0B' : '#10B981'), className: '', iconSize: [26, 26], iconAnchor: [13, 13] });
                return (
                  <Marker key={i} position={[center.location.lat, center.location.lng]} icon={icon} eventHandlers={{ click: () => setSelectedCenter(center) }}>
                    <Popup autoPan={false}>
                      <div className="pr-2 py-1 min-w-[180px] font-sans">
                        <strong className="text-[14px] font-bold text-slate-800 block mb-2">{center.name}</strong>
                        <div className="text-xs text-slate-600 font-medium space-y-1.5">
                          <div className="flex gap-2"><MdLocationOn className="text-rose-400 shrink-0 mt-0.5" size={14}/><span>{center.address}</span></div>
                          <div className="flex gap-2"><MdPhone className="text-slate-400 shrink-0" size={14}/><span>{center.contact}</span></div>
                          <div className="flex gap-2"><MdAccessTime className="text-blue-400 shrink-0" size={14}/><span>{center.operatingHours}</span></div>
                          {center.distance !== undefined && <div className="text-emerald-600 font-bold mt-2 pt-2 border-t border-slate-100">Distance: {center.distance} km</div>}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
