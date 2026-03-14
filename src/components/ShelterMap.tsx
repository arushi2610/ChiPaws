import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  Dog, 
  Home, 
  ShoppingBag, 
  Trees, 
  Heart, 
  Phone, 
  Mail, 
  ExternalLink,
  Filter,
  Loader2
} from 'lucide-react';

// Fix Leaflet icon issue
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapItem {
  id: string;
  type: 'shelter' | 'rescue' | 'adoptable' | 'park' | 'store' | 'donation';
  name: string;
  lat: number;
  lng: number;
  details?: any;
}

export default function ShelterMap() {
  const [items, setItems] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    shelter: true,
    rescue: true,
    adoptable: true,
    park: true,
    store: true,
    donation: true
  });

  const chicagoCenter: [number, number] = [41.8781, -87.6298];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const allItems: MapItem[] = [];

      try {
        // 1. Fetch Adoptable Dogs (Petfinder Proxy)
        const petsRes = await fetch('/api/pets');
        if (petsRes.ok) {
          const data = await petsRes.json();
          data.animals?.forEach((animal: any) => {
            if (animal.contact?.address?.city === 'Chicago' || animal.distance < 20) {
              // Mocking lat/lng if not provided (Petfinder doesn't always give exact coords)
              // In a real app, we'd geocode the address
              allItems.push({
                id: `pet-${animal.id}`,
                type: 'adoptable',
                name: animal.name,
                lat: chicagoCenter[0] + (Math.random() - 0.5) * 0.1,
                lng: chicagoCenter[1] + (Math.random() - 0.5) * 0.1,
                details: animal
              });
            }
          });
        }

        // 2. Fetch Shelters (RescueGroups Proxy)
        const sheltersRes = await fetch('/api/shelters');
        if (sheltersRes.ok) {
          const data = await sheltersRes.json();
          data.data?.forEach((org: any) => {
            allItems.push({
              id: `org-${org.id}`,
              type: org.attributes.type === 'Rescue' ? 'rescue' : 'shelter',
              name: org.attributes.name,
              lat: chicagoCenter[0] + (Math.random() - 0.5) * 0.1,
              lng: chicagoCenter[1] + (Math.random() - 0.5) * 0.1,
              details: org.attributes
            });
          });
        }

        // 3. Fetch Dog Parks & Pet Stores (Overpass API)
        const overpassUrl = 'https://overpass-api.de/api/interpreter';
        const query = `
          [out:json];
          (
            node["leisure"="dog_park"](41.6443,-87.9402,42.0231,-87.5240);
            node["shop"="pet"](41.6443,-87.9402,42.0231,-87.5240);
          );
          out;
        `;
        const overpassRes = await fetch(overpassUrl, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`
        });
        if (overpassRes.ok) {
          const data = await overpassRes.json();
          data.elements.forEach((el: any) => {
            allItems.push({
              id: `osm-${el.id}`,
              type: el.tags.leisure === 'dog_park' ? 'park' : 'store',
              name: el.tags.name || (el.tags.leisure === 'dog_park' ? 'Dog Park' : 'Pet Store'),
              lat: el.lat,
              lng: el.lon,
              details: el.tags
            });
          });
        }

        // 4. Add some static Donation Locations
        const donationLocs: MapItem[] = [
          { id: 'don-1', type: 'donation', name: 'ChiPaws Donation Hub', lat: 41.8948, lng: -87.6353, details: { address: '123 W Chicago Ave', hours: '9am-5pm' } },
          { id: 'don-2', type: 'donation', name: 'North Side Rescue Bin', lat: 41.9483, lng: -87.6553, details: { address: '456 N Clark St', hours: '24/7' } }
        ];
        allItems.push(...donationLocs);

        setItems(allItems);
      } catch (err) {
        console.error("Error fetching map data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getIcon = (type: string) => {
    const colors: any = {
      shelter: '#3b82f6', // blue
      rescue: '#8b5cf6', // violet
      adoptable: '#ef4444', // red
      park: '#22c55e', // green
      store: '#f59e0b', // amber
      donation: '#ec4899' // pink
    };

    return L.divIcon({
      html: `<div style="background-color: ${colors[type]}; padding: 8px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${type === 'adoptable' ? '<path d="M10 5.172C10 3.782 8.823 2.65 7.44 2.65 6.058 2.65 4.88 3.782 4.88 5.172c0 1.39 1.177 2.522 2.56 2.522 1.383 0 2.56-1.132 2.56-2.522Z"/><path d="M19.12 5.172c0-1.39-1.177-2.522-2.56-2.522-1.383 0-2.56 1.132-2.56 2.522 0 1.39 1.177 2.522 2.56 2.522 1.383 0 2.56-1.132 2.56-2.522Z"/><path d="M7.44 10.172c0-1.39-1.177-2.522-2.56-2.522-1.383 0-2.56 1.132-2.56 2.522 0 1.39 1.177 2.522 2.56 2.522 1.383 0 2.56-1.132 2.56-2.522Z"/><path d="M21.68 10.172c0-1.39-1.177-2.522-2.56-2.522-1.383 0-2.56 1.132-2.56 2.522 0 1.39 1.177 2.522 2.56 2.522 1.383 0 2.56-1.132 2.56-2.522Z"/><path d="M12 13.172a5 5 0 0 1 5 5 2 2 0 0 1-2 2H9a2 2 0 0 1-2-2 5 5 0 0 1 5-5Z"/>' : 
                  type === 'park' ? '<path d="M12 2L2 22h20L12 2z"/>' :
                  type === 'store' ? '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>' :
                  type === 'donation' ? '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>' :
                  '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'}
              </svg>
            </div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });
  };

  const filteredItems = items.filter(item => filters[item.type]);

  return (
    <div className="flex flex-col h-[700px] border-4 border-black rounded-[40px] overflow-hidden bg-white shadow-[15px_15px_0px_0px_rgba(0,0,0,1)]">
      {/* Map Header / Filters */}
      <div className="p-6 border-b-4 border-black bg-chipaws-blue/5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-chipaws-blue p-2 rounded-xl border-2 border-black">
            <MapPin className="text-white" size={24} />
          </div>
          <h2 className="font-display text-3xl uppercase">Chicago Rescue Map</h2>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setFilters(prev => ({ ...prev, [key]: !val }))}
              className={`px-4 py-2 rounded-xl border-2 border-black font-bangers text-lg transition-all ${
                val ? 'bg-chipaws-yellow shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-slate-400'
              }`}
            >
              {key.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Map Content */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-[1000] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-chipaws-blue mb-4" size={48} />
            <p className="font-bangers text-2xl tracking-widest">SNIFFING OUT DATA...</p>
          </div>
        )}
        
        <MapContainer 
          center={chicagoCenter} 
          zoom={12} 
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {filteredItems.map(item => (
            <Marker 
              key={item.id} 
              position={[item.lat, item.lng]} 
              icon={getIcon(item.type)}
            >
              <Popup className="custom-popup">
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase`} style={{ backgroundColor: 
                      item.type === 'adoptable' ? '#ef4444' : 
                      item.type === 'park' ? '#22c55e' : 
                      item.type === 'store' ? '#f59e0b' : 
                      '#3b82f6'
                    }}>
                      {item.type}
                    </span>
                    <h4 className="font-bold text-lg leading-tight">{item.name}</h4>
                  </div>
                  
                  {item.type === 'adoptable' && (
                    <div className="space-y-2">
                      <img src={item.details.photos?.[0]?.medium} className="w-full h-32 object-cover rounded-lg border border-black" alt={item.name} />
                      <p className="text-sm text-slate-600 line-clamp-2">{item.details.description}</p>
                      <a href={item.details.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-chipaws-red text-white py-2 rounded-lg font-bold text-sm">
                        <Dog size={14} /> ADOPT ME
                      </a>
                    </div>
                  )}

                  {(item.type === 'shelter' || item.type === 'rescue') && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">{item.details.description}</p>
                      <div className="flex flex-col gap-1 text-xs">
                        {item.details.email && <div className="flex items-center gap-1"><Mail size={12}/> {item.details.email}</div>}
                        {item.details.phone && <div className="flex items-center gap-1"><Phone size={12}/> {item.details.phone}</div>}
                      </div>
                      <button className="w-full bg-chipaws-blue text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2">
                        <Heart size={14} /> DONATE
                      </button>
                    </div>
                  )}

                  {item.type === 'park' && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Dog-friendly park</p>
                      {item.details.opening_hours && <p className="text-xs text-slate-500">Hours: {item.details.opening_hours}</p>}
                    </div>
                  )}

                  {item.type === 'store' && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Pet supplies & food</p>
                      {item.details.website && (
                        <a href={item.details.website} target="_blank" rel="noreferrer" className="text-xs text-chipaws-blue flex items-center gap-1">
                          <ExternalLink size={10} /> Website
                        </a>
                      )}
                    </div>
                  )}

                  {item.type === 'donation' && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">Drop off food, blankets, and toys here!</p>
                      <p className="text-xs font-bold">Address: {item.details.address}</p>
                      <p className="text-xs">Hours: {item.details.hours}</p>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
