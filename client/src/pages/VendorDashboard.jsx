import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPickupRequests, submitBid, updatePickupStatus } from '../services/api';
import { MdStorefront, MdSchedule, MdCheckCircle, MdLocalShipping, MdOutlineLocationOn } from 'react-icons/md';

export default function VendorDashboard() {
  const { user } = useAuth();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  // Bidding inputs per request
  const [bids, setBids] = useState({});

  useEffect(() => {
    fetchRequests();
  }, [refresh]);

  const fetchRequests = async () => {
    try {
      const res = await getPickupRequests();
      setRequests(res.data.data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBidChange = (reqId, val) => {
    setBids(prev => ({...prev, [reqId]: val}));
  };

  const handleBidSubmit = async (e, reqId) => {
    e.preventDefault();
    const amount = bids[reqId];
    if (!amount) return;
    try {
      await submitBid(reqId, user.name, Number(amount));
      setBids(prev => ({...prev, [reqId]: ''}));
      setRefresh(r => r + 1);
      alert('Bid placed successfully!');
    } catch (err) {
      alert('Failed to place bid.');
    }
  };

  const handleScheduleRegular = async (reqId) => {
    try {
      await updatePickupStatus(reqId, 'Scheduled', user.name);
      setRefresh(r => r + 1);
      alert('Pickup assigned to you and scheduled!');
    } catch (err) {
      alert('Failed to schedule pickup.');
    }
  };

  const handleCompletePickup = async (reqId) => {
    try {
      await updatePickupStatus(reqId, 'Completed', user.name);
      setRefresh(r => r + 1);
      alert('Pickup marked as completed.');
    } catch (err) {
      alert('Failed to complete pickup.');
    }
  };

  // Derived states
  const marketplaceRequests = requests.filter(r => r.status === 'Pending');
  const myScheduled = requests.filter(r => r.status === 'Scheduled' && r.assignedVendor === user.name);
  const myCompleted = requests.filter(r => r.status === 'Completed' && r.assignedVendor === user.name);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="spinner-premium mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="page-title">Vendor Marketplace</h1>
        <p className="page-subtitle">Bid on bulk requests, schedule pickups, and track your fleet.</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="premium-card p-6 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <MdStorefront size={18} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available Jobs</p>
          </div>
          <p className="text-3xl font-black text-slate-800 tracking-tight">{marketplaceRequests.length}</p>
        </div>

        <div className="premium-card p-6 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <MdSchedule size={18} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">My Scheduled</p>
          </div>
          <p className="text-3xl font-black text-slate-800 tracking-tight">{myScheduled.length}</p>
        </div>

        <div className="premium-card p-6 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <MdCheckCircle size={18} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Completed</p>
          </div>
          <p className="text-3xl font-black text-slate-800 tracking-tight">{myCompleted.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Marketplace List */}
        <div className="premium-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="section-title mb-0 flex items-center gap-2">
              <MdOutlineLocationOn className="text-emerald-500" />
              Open Marketplace
            </h3>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{marketplaceRequests.length} pending</span>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px] hide-scrollbar pr-2">
            {marketplaceRequests.length === 0 && (
              <p className="text-slate-500 italic text-sm">No pending requests in your area.</p>
            )}
            
            {marketplaceRequests.map(req => {
              const hasBid = req.bids?.some(b => b.vendorName === user.name);

              return (
                <div key={req._id} className="border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow bg-slate-50/50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      {req.isBulk ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-md mb-2">
                          Bulk Job: {req.weight}kg
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-md mb-2">
                          Standard Pickup
                        </div>
                      )}
                      <h4 className="font-bold text-slate-800 text-sm">{req.address}</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Time: <span className="text-slate-700 font-bold">{req.preferredTime}</span> • Type: {req.wasteType}
                      </p>
                    </div>
                    {req.requestedBy && (
                      <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">
                        {req.requestedBy}
                      </span>
                    )}
                  </div>

                  {req.isBulk ? (
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      {hasBid ? (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg text-sm font-bold">
                          <MdCheckCircle /> Bid submitted. Waiting for approval.
                        </div>
                      ) : (
                        <form onSubmit={(e) => handleBidSubmit(e, req._id)} className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Enter bid (₹)"
                            required
                            min="100"
                            className="flex-1 form-input py-2 text-sm"
                            value={bids[req._id] || ''}
                            onChange={(e) => handleBidChange(req._id, e.target.value)}
                          />
                          <button type="submit" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors">
                            Place Bid
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
                      <button
                        onClick={() => handleScheduleRegular(req._id)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-colors w-full sm:w-auto"
                      >
                        Claim & Schedule
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* My Tasks Tracker */}
        <div className="premium-card p-6">
          <h3 className="section-title mb-6 flex items-center gap-2">
            <MdLocalShipping className="text-blue-500" />
            My Active Fleet Schedule
          </h3>
          
          <div className="space-y-4">
            {myScheduled.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
                <MdSchedule className="mx-auto text-slate-300 mb-3" size={40} />
                <p className="text-slate-500 font-bold text-sm">No scheduled pickups.</p>
                <p className="text-xs text-slate-400 mt-1">Claim jobs from the marketplace to get started.</p>
              </div>
            ) : (
              myScheduled.map(req => (
                <div key={req._id} className="flex gap-4 p-4 border border-blue-100 bg-blue-50/30 rounded-xl">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    {req.preferredTime.split(':')[0]}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm">{req.address}</h4>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                      {req.isBulk ? `Bulk (${req.weight}kg)` : 'Standard'} • {req.wasteType}
                    </p>
                    <p className="text-xs text-blue-600 font-bold mt-2">
                      Client: {req.requestedBy}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => handleCompletePickup(req._id)}
                      className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md transition-transform hover:scale-105"
                      title="Mark as Completed"
                    >
                      <MdCheckCircle size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Just a tiny widget for completed */}
          {myCompleted.length > 0 && (
             <div className="mt-8 pt-6 border-t border-slate-100">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recently Completed</p>
               <div className="space-y-2">
                 {myCompleted.slice(0, 3).map(req => (
                   <div key={req._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                     <div>
                       <p className="text-xs font-bold text-slate-700">{req.address}</p>
                       <p className="text-[10px] text-slate-400 font-semibold">{req.isBulk ? 'Bulk' : 'Standard'} • {req.wasteType}</p>
                     </div>
                     <span className="text-emerald-500"><MdCheckCircle size={18} /></span>
                   </div>
                 ))}
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
