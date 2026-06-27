import { useState, useEffect } from 'react';
import { vendorService } from '../../../api/vendorService';
import toast from 'react-hot-toast';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function OperatingHoursPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState({});

  useEffect(() => {
    fetchHours();
  }, []);

  const fetchHours = async () => {
    try {
      setLoading(true);
      const data = await vendorService.getOperatingHours();
      // data might be empty if not set yet, initialize defaults
      const initialHours = {};
      DAYS_OF_WEEK.forEach(day => {
        initialHours[day] = data[day] || { isOpen: false, openTime: '09:00', closeTime: '17:00' };
      });
      setHours(initialHours);
    } catch (error) {
      toast.error('Failed to load operating hours');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (day) => {
    setHours(prev => ({
      ...prev,
      [day]: { ...prev[day], isOpen: !prev[day].isOpen }
    }));
  };

  const handleChangeTime = (day, field, value) => {
    setHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await vendorService.updateOperatingHours(hours);
      toast.success('Operating hours updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update operating hours');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-header"><h3>Loading...</h3></div>;
  }

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Operating Hours</h1>
          <p>Set your weekly store schedule.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '800px' }}>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="flex items-center" style={{ gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ width: '120px', textTransform: 'capitalize', fontWeight: '500' }}>
                    {day}
                  </div>
                  
                  <div>
                    <label className="flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={hours[day]?.isOpen}
                        onChange={() => handleToggle(day)}
                        style={{ marginRight: '0.5rem' }}
                      />
                      {hours[day]?.isOpen ? 'Open' : 'Closed'}
                    </label>
                  </div>

                  {hours[day]?.isOpen && (
                    <div className="flex items-center" style={{ gap: '0.5rem' }}>
                      <input 
                        type="time" 
                        className="form-input" 
                        style={{ width: '120px' }}
                        value={hours[day]?.openTime || '09:00'}
                        onChange={(e) => handleChangeTime(day, 'openTime', e.target.value)}
                        required={hours[day]?.isOpen}
                      />
                      <span>to</span>
                      <input 
                        type="time" 
                        className="form-input" 
                        style={{ width: '120px' }}
                        value={hours[day]?.closeTime || '17:00'}
                        onChange={(e) => handleChangeTime(day, 'closeTime', e.target.value)}
                        required={hours[day]?.isOpen}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ paddingTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
