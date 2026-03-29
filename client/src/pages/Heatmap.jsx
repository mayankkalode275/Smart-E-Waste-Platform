import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { getWasteData, getPredictions } from '../services/api';
import {
  MdGpsFixed, MdLayers, MdRefresh, MdThermostat,
  MdAutoGraph, MdAccessTime, MdCalendarToday, MdPsychology,
} from 'react-icons/md';

// ─── Constants ───────────────────────────────────────────────
const MAP_CENTER = [19.0760, 72.8777]; // Mumbai
const WASTE_LEVEL_INTENSITY = { High: 1.0, Medium: 0.6, Low: 0.25 };
const LEVEL_COLORS = { High: '#F43F5E', Medium: '#F59E0B', Low: '#10B981' };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return `${h}:00 ${ampm}`;
});

// Unified strong gradient for clear visibility
const STRONG_GRADIENT = {
  0.1: 'blue',
  0.3: 'cyan',
  0.5: 'yellow',
  0.7: 'orange',
  1.0: 'red',
};

const HEAT_BASE = { radius: 30, blur: 18, maxZoom: 17, minOpacity: 0.35 };

// ─── Marker icon builder ─────────────────────────────────────
const getMarkerHtml = (color) => `
  <div style="
    background: ${color};
    width: 12px; height: 12px;
    border-radius: 50%;
    border: 2.5px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  "></div>
`;

// ─── Heat Layer (imperative React‑Leaflet component) ─────────
function HeatLayer({ points, gradient }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map || points.length === 0) return;

    if (layerRef.current) map.removeLayer(layerRef.current);

    layerRef.current = L.heatLayer(points, {
      ...HEAT_BASE,
      gradient,
    }).addTo(map);

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [map, points, gradient]);

  return null;
}

// ─── Convert API reports → heat points ───────────────────────
function toHeatPoints(data) {
  return data.map((w) => [
    w.location.lat,
    w.location.lng,
    WASTE_LEVEL_INTENSITY[w.wasteLevel] ?? 0.3,
  ]);
}

// ─── Convert prediction response → heat points ──────────────
function predictionToHeatPoints(predictions) {
  return predictions.map((p) => [p.lat, p.lng, p.intensity]);
}

// ─── Heatmap Page ────────────────────────────────────────────
export default function Heatmap() {
  // Data states
  const [wasteData, setWasteData] = useState([]);
  const [currentHeatPoints, setCurrentHeatPoints] = useState([]);
  const [predictedHeatPoints, setPredictedHeatPoints] = useState([]);
  const [predictions, setPredictions] = useState([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mode, setMode] = useState('current'); // 'current' | 'predicted'

  // Prediction controls
  const now = new Date();
  const [targetHour, setTargetHour] = useState(now.getHours());
  const [targetDay, setTargetDay] = useState((now.getDay() + 6) % 7); // JS Sunday=0 → our Monday=0

  // Model info
  const [modelInfo, setModelInfo] = useState(null);

  // Stats
  const currentStats = {
    total: wasteData.length,
    high: wasteData.filter((w) => w.wasteLevel === 'High').length,
    medium: wasteData.filter((w) => w.wasteLevel === 'Medium').length,
    low: wasteData.filter((w) => w.wasteLevel === 'Low').length,
  };

  const predictedStats = {
    total: predictions.length,
    high: predictions.filter((p) => p.intensity >= 0.7).length,
    medium: predictions.filter((p) => p.intensity >= 0.35 && p.intensity < 0.7).length,
    low: predictions.filter((p) => p.intensity < 0.35).length,
    avgIntensity: predictions.length > 0
      ? (predictions.reduce((s, p) => s + p.intensity, 0) / predictions.length).toFixed(2)
      : '—',
  };

  const stats = mode === 'current' ? currentStats : predictedStats;

  // ── Fetch current waste data ──
  const fetchCurrentData = async () => {
    setLoading(true);
    try {
      const res = await getWasteData();
      const reports = res.data.data;
      setWasteData(reports);
      setCurrentHeatPoints(toHeatPoints(reports));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch waste data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch predictions ──
  const fetchPredictions = async () => {
    setPredicting(true);
    try {
      const res = await getPredictions(targetHour, targetDay);
      const data = res.data;
      setPredictions(data.predictions);
      setPredictedHeatPoints(predictionToHeatPoints(data.predictions));
      setModelInfo(data.model_info);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch predictions:', err);

      // If ML service is down, show a user-friendly state
      if (err.response?.status === 503) {
        setPredictions([]);
        setPredictedHeatPoints([]);
      }
    } finally {
      setPredicting(false);
    }
  };

  useEffect(() => { fetchCurrentData(); }, []);

  // Auto-fetch predictions when switching to predicted mode or changing params
  useEffect(() => {
    if (mode === 'predicted') fetchPredictions();
  }, [mode, targetHour, targetDay]);

  // Active heat points & gradient based on mode
  const activePoints = mode === 'current' ? currentHeatPoints : predictedHeatPoints;
  const activeGradient = STRONG_GRADIENT;

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="spinner-premium mx-auto mb-4"></div>
          <p className="text-slate-500 font-semibold tracking-wide">Loading heatmap data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Garbage Heatmap</h1>
          <p className="page-subtitle">
            {mode === 'current'
              ? 'Real‑time density visualization of waste hotspots across the city.'
              : 'AI‑predicted garbage density based on location, time, and area characteristics.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Toggle — Current / Predicted */}
          <div className="bg-white rounded-xl p-1 shadow-sm border border-slate-200 flex relative">
            <div
              className="absolute top-1 bottom-1 rounded-lg shadow-sm transition-all duration-300 ease-out z-0"
              style={{
                width: 'calc(50% - 4px)',
                background: mode === 'current'
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                transform: mode === 'current' ? 'translateX(2px)' : 'translateX(calc(100% + 4px))',
              }}
            />
            <button
              onClick={() => setMode('current')}
              className={`relative z-10 flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                mode === 'current' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MdThermostat size={14} /> Current
            </button>
            <button
              onClick={() => setMode('predicted')}
              className={`relative z-10 flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                mode === 'predicted' ? 'text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MdPsychology size={14} /> Predicted
            </button>
          </div>

          {/* Toggle Markers */}
          <button
            onClick={() => setShowMarkers((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold border transition-all duration-200 ${
              showMarkers
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <MdLayers size={16} />
          </button>

          {/* Refresh */}
          <button
            onClick={mode === 'current' ? fetchCurrentData : fetchPredictions}
            disabled={predicting}
            className="btn-premium px-4 py-2.5 flex items-center gap-2"
          >
            {predicting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <MdRefresh size={16} />
            )}
          </button>
        </div>
      </div>

      {/* ── Prediction Controls (only in predicted mode) ── */}
      {mode === 'predicted' && (
        <div className="premium-card p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-bold text-violet-600">
            <MdAutoGraph size={20} />
            <span>Prediction Parameters</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 flex-1">
            {/* Day Selector */}
            <div className="flex items-center gap-2">
              <MdCalendarToday size={16} className="text-slate-400" />
              <select
                value={targetDay}
                onChange={(e) => setTargetDay(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all"
              >
                {DAYS.map((day, i) => (
                  <option key={i} value={i}>{day}</option>
                ))}
              </select>
            </div>

            {/* Hour Selector */}
            <div className="flex items-center gap-2">
              <MdAccessTime size={16} className="text-slate-400" />
              <select
                value={targetHour}
                onChange={(e) => setTargetHour(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all"
              >
                {HOURS.map((label, i) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            </div>

            {/* Quick Presets */}
            <div className="flex gap-1.5">
              {[
                { label: 'Morning Rush', hour: 8, day: targetDay },
                { label: 'Evening Peak', hour: 18, day: targetDay },
                { label: 'Weekend AM', hour: 10, day: 5 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => { setTargetHour(preset.hour); setTargetDay(preset.day); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-violet-50 text-violet-600 border border-violet-100 hover:bg-violet-100 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {predicting && (
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-500">
              <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              Predicting...
            </div>
          )}
        </div>
      )}

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Leaflet Map */}
        <div
          className="lg:col-span-3 premium-card overflow-hidden p-2 relative"
          style={{ minHeight: '550px' }}
        >
          {/* Mode indicator badge */}
          <div className="absolute top-4 left-4 z-10">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm ${
              mode === 'current'
                ? 'bg-emerald-500/90 text-white'
                : 'bg-violet-500/90 text-white'
            }`}>
              {mode === 'current' ? <MdThermostat size={14} /> : <MdPsychology size={14} />}
              {mode === 'current' ? 'LIVE DATA' : `PREDICTED — ${DAYS[targetDay]} ${HOURS[targetHour]}`}
            </div>
          </div>

          <div className="w-full h-full rounded-xl overflow-hidden relative z-0">
            <MapContainer
              center={MAP_CENTER}
              zoom={12}
              style={{ height: '100%', width: '100%', zIndex: 1 }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
              />

              {/* Active heatmap layer */}
              <HeatLayer points={activePoints} gradient={activeGradient} />

              {/* Markers (only in current mode, or if toggled on) */}
              {showMarkers && mode === 'current' &&
                wasteData.map((waste, i) => {
                  const color = LEVEL_COLORS[waste.wasteLevel] || '#10B981';
                  const icon = L.divIcon({
                    html: getMarkerHtml(color),
                    className: '',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                  });
                  return (
                    <Marker
                      key={waste._id || i}
                      position={[waste.location.lat, waste.location.lng]}
                      icon={icon}
                    >
                      <Popup className="premium-popup">
                        <div className="min-w-[200px] font-sans">
                          <strong className="text-[14px] font-bold text-slate-800 block mb-2">
                            {waste.address || 'Reported Location'}
                          </strong>
                          <div className="text-xs text-slate-600 font-medium space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Severity</span>
                              <span style={{ color: LEVEL_COLORS[waste.wasteLevel] }} className="font-bold">{waste.wasteLevel}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Category</span>
                              <span>{waste.wasteType}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Status</span>
                              <span className="text-slate-800 font-bold">{waste.status}</span>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

              {/* Predicted mode: show top hotspot markers */}
              {showMarkers && mode === 'predicted' &&
                predictions
                  .filter((p) => p.intensity >= 0.6)
                  .map((p, i) => {
                    const color = p.intensity >= 0.8 ? '#ec4899' : p.intensity >= 0.6 ? '#a855f7' : '#6366f1';
                    const icon = L.divIcon({
                      html: getMarkerHtml(color),
                      className: '',
                      iconSize: [12, 12],
                      iconAnchor: [6, 6],
                    });
                    return (
                      <Marker key={`pred-${i}`} position={[p.lat, p.lng]} icon={icon}>
                        <Popup className="premium-popup">
                          <div className="min-w-[180px] font-sans">
                            <strong className="text-[14px] font-bold text-slate-800 block mb-2">
                              {p.area || 'Predicted Hotspot'}
                            </strong>
                            <div className="text-xs text-slate-600 font-medium space-y-1.5">
                              <div className="flex justify-between">
                                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Predicted</span>
                                <span className="font-bold text-violet-600">{(p.intensity * 100).toFixed(0)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Day</span>
                                <span>{DAYS[targetDay]}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Time</span>
                                <span>{HOURS[targetHour]}</span>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
            </MapContainer>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="space-y-5 flex flex-col lg:max-h-[620px]">
          {/* Intensity Legend */}
          <div className="premium-card p-5">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <MdThermostat size={14} />
              {mode === 'current' ? 'Intensity Scale' : 'Prediction Scale'}
            </h3>

            <div
              className="h-3 rounded-full mb-4 shadow-inner"
              style={{
                background: 'linear-gradient(to right, blue 10%, cyan 30%, yellow 50%, orange 70%, red 100%)',
              }}
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-5">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>

            <div className="space-y-3 text-[13px] font-bold text-slate-600">
              {[
                { color: 'cyan', label: mode === 'current' ? 'Low Garbage Density' : 'Low Predicted Waste' },
                { color: 'orange', label: mode === 'current' ? 'Medium Garbage Density' : 'Medium Predicted Waste' },
                { color: 'red', label: mode === 'current' ? 'High Garbage Density' : 'High Predicted Waste' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ background: item.color }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="premium-card p-5">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <MdGpsFixed size={14} />
              {mode === 'current' ? 'Hotspot Statistics' : 'Prediction Stats'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {mode === 'current' ? 'Total Points' : 'Grid Points'}
                </p>
                <p className="text-2xl font-black text-slate-800">{stats.total}</p>
              </div>
              <div className={`rounded-xl p-3 border ${mode === 'current' ? 'bg-rose-50 border-rose-100' : 'bg-pink-50 border-pink-100'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${mode === 'current' ? 'text-rose-400' : 'text-pink-400'}`}>
                  {mode === 'current' ? 'High Severity' : 'High Risk'}
                </p>
                <p className={`text-2xl font-black ${mode === 'current' ? 'text-rose-600' : 'text-pink-600'}`}>{stats.high}</p>
              </div>
              <div className={`rounded-xl p-3 border ${mode === 'current' ? 'bg-amber-50 border-amber-100' : 'bg-violet-50 border-violet-100'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${mode === 'current' ? 'text-amber-500' : 'text-violet-400'}`}>
                  Medium
                </p>
                <p className={`text-2xl font-black ${mode === 'current' ? 'text-amber-600' : 'text-violet-600'}`}>{stats.medium}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Low</p>
                <p className="text-2xl font-black text-emerald-600">{stats.low}</p>
              </div>
            </div>

            {/* Average Intensity (prediction mode only) */}
            {mode === 'predicted' && (
              <div className="mt-3 flex justify-between items-center py-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Intensity</span>
                <span className="font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-md text-sm">
                  {predictedStats.avgIntensity}
                </span>
              </div>
            )}
          </div>

          {/* Model Info (prediction mode only) */}
          {mode === 'predicted' && modelInfo && (
            <div className="premium-card p-4 bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100">
              <h3 className="text-xs font-extrabold text-violet-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <MdPsychology size={14} /> AI Model
              </h3>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Type</span>
                  <span className="font-bold text-violet-700">{modelInfo.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Accuracy (R²)</span>
                  <span className="font-bold text-violet-700">{modelInfo.r2}</span>
                </div>
              </div>
            </div>
          )}

          {/* Last Updated */}
          {lastUpdated && (
            <div className="premium-card p-3 text-center bg-slate-50 border-dashed border-2 border-slate-200 shadow-none">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {mode === 'current' ? 'Last Synced' : 'Last Predicted'}
              </p>
              <p className="text-sm font-bold text-slate-700">
                {lastUpdated.toLocaleTimeString('en-IN', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
