/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Heart, 
  Dog as DogIcon, 
  DollarSign, 
  Share2, 
  X, 
  Award, 
  TrendingUp,
  Info,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Users,
  Building2
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Dog, ImpactStats, BadgeType } from './types';
import { DOGS } from './data/dogs';
import { PUPPIES } from './data/puppies';

// Error Handling Spec for Firestore Permissions
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Fix Leaflet icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'discover' | 'puppies'>('discover');
  const [selectedDog, setSelectedDog] = useState<Dog | null>(null);
  const [showDonationModal, setShowDonationModal] = useState<Dog | null>(null); // Track which dog is being donated to
  const [showSuccessScreen, setShowSuccessScreen] = useState<{ amount: number; dogName: string } | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState<{ type: BadgeType; dogName?: string; certId?: string } | null>(null);
  const [shelters, setShelters] = useState<any[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [stats, setStats] = useState<ImpactStats>({
    dogsHelped: 1200,
    donationsMade: 15420,
    adoptionRequests: 85
  });
  const [realDogs, setRealDogs] = useState<Dog[]>(DOGS);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Sync user to Firestore
  useEffect(() => {
    if (user) {
      const syncUser = async () => {
        const userRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              role: 'user',
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      };
      syncUser();
    }
  }, [user]);

  // Test Connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  // Fetch real dog data from Petfinder via our proxy
  useEffect(() => {
    const fetchDogs = async () => {
      try {
        const response = await fetch('/api/dogs');
        const data = await response.json();
        if (data.animals) {
          const mappedDogs: Dog[] = data.animals.map((animal: any) => ({
            id: animal.id.toString(),
            name: animal.name,
            age: animal.age,
            breed: animal.breeds.primary,
            shelter: animal.contact.address.city + ", " + animal.contact.address.state,
            location: { 
              x: 30 + Math.random() * 40, // Randomly spread for demo map
              y: 30 + Math.random() * 40 
            },
            photo: animal.photos[0]?.large || 'https://images.dog.ceo/breeds/retriever-golden/n02099601_5709.jpg',
            description: animal.description || `Meet ${animal.name}, a lovely ${animal.breeds.primary} looking for a home in Chicago!`
          }));
          setRealDogs(mappedDogs);
        }
      } catch (error) {
        console.error("Error fetching dogs:", error);
        setRealDogs(DOGS); // Fallback to mock data
      }
    };
    fetchDogs();
  }, []);

  // Fetch real shelter data from Overpass API
  useEffect(() => {
    const fetchShelters = async (retries = 2) => {
      const query = `[out:json][timeout:15];
        area["name"="Chicago"]["admin_level"="4"]->.searchArea;
        (
          node["amenity"="animal_shelter"](area.searchArea);
          way["amenity"="animal_shelter"](area.searchArea);
          rel["amenity"="animal_shelter"](area.searchArea);
        );
        out center;`;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s fetch timeout

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 504 && retries > 0) {
            console.warn("Overpass 504 Timeout, retrying...");
            return fetchShelters(retries - 1);
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("Received non-JSON response:", text.substring(0, 200));
          throw new Error("API returned non-JSON response");
        }

        const data = await response.json();
        if (data && data.elements) {
          setShelters(data.elements);
        }
      } catch (error: any) {
        if (error.name === 'AbortError' && retries > 0) {
          console.warn("Overpass fetch aborted, retrying...");
          return fetchShelters(retries - 1);
        }
        console.error("Error fetching Overpass data:", error);
        setShelters([]);
      } finally {
        setLoadingMap(false);
      }
    };
    fetchShelters();
  }, []);

  const handleAdopt = (dog: Dog) => {
    setStats(prev => ({ ...prev, adoptionRequests: prev.adoptionRequests + 1 }));
    setShowBadgeModal({ type: 'Rescue Hero', dogName: dog.name });
    setSelectedDog(null);
  };

  const handleStripeDonate = async (amount: number) => {
    if (!showDonationModal) return;
    
    const dogName = showDonationModal.name;
    
    // Simulate Stripe checkout and success
    setShowDonationModal(null);
    setShowSuccessScreen({ amount, dogName });
    
    // In a real app, we'd call the backend:
    /*
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount,
          userId: user?.uid,
          dogId: showDonationModal.id
        })
      });
      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      }
    } catch (error) {
      console.error("Stripe error:", error);
    }
    */
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Check for success URL param (simulating Stripe redirect back)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      // In a real app, we'd verify the session on the backend
      // For this demo, we'll just show the badge
      setShowBadgeModal({ type: 'Dog Supporter', certId: 'demo-cert-id' });
      // Clean up URL
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const addToLinkedIn = (type: string) => {
    const certUrl = `${window.location.origin}/certificate/demo-cert-id`;
    const linkedinUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(type + ' - ChiPaws Chicago')}&organizationName=ChiPaws&issueYear=2026&issueMonth=3&certUrl=${encodeURIComponent(certUrl)}`;
    window.open(linkedinUrl, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-chicago-blue rounded-full flex items-center justify-center text-white">
              <DogIcon size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Chi<span className="text-chicago-blue">Paws</span>
            </h1>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button 
              onClick={() => setActiveTab('discover')}
              className={`${activeTab === 'discover' ? 'text-chicago-blue' : 'hover:text-chicago-blue'} transition-colors`}
            >
              Discover
            </button>
            <button 
              onClick={() => setActiveTab('puppies')}
              className={`${activeTab === 'puppies' ? 'text-chicago-blue' : 'hover:text-chicago-blue'} transition-colors`}
            >
              Puppies
            </button>
            <a href="#mission" className="hover:text-chicago-blue transition-colors">Our Mission</a>
            
            {isAuthReady && (
              user ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                      alt={user.displayName || 'User'} 
                      className="w-8 h-8 rounded-full border border-slate-200"
                    />
                    <span className="text-slate-900 font-bold">{user.displayName?.split(' ')[0]}</span>
                  </div>
                  <button 
                    onClick={logout}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button 
                  onClick={login}
                  className="text-slate-600 hover:text-chicago-blue transition-colors font-bold"
                >
                  Sign In
                </button>
              )
            )}

            <button 
              onClick={() => setShowDonationModal(PUPPIES[0])}
              className="bg-chicago-red text-white px-6 py-2 rounded-full hover:bg-red-600 transition-all font-bold shadow-lg shadow-red-100 flex items-center gap-2"
            >
              <Heart size={16} />
              Donate Now
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {activeTab === 'discover' ? (
          <>
            {/* Hero Section */}
            <section className="bg-white py-20 px-4 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-chicago-blue/5 -skew-x-12 translate-x-1/2" />
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center relative">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              
              <h2 className="text-6xl font-bold text-slate-900 leading-tight mb-6">
                Every Dog Deserves a <span className="text-chicago-blue">Chicago</span> Home.
              </h2>
              <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                We're on a mission to empty Chicago's shelters. Join 1,200+ supporters who have already helped puppies find their forever families.
              </p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setShowDonationModal(PUPPIES[0])}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl"
                >
                  Donate via Stripe
                </button>
                <a 
                  href="#mission"
                  className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-bold text-lg hover:border-chicago-blue hover:text-chicago-blue transition-all"
                >
                  Our Mission
                </a>
              </div>
            </motion.div>

            <div className="relative">
              <div className="aspect-[4/5] bg-slate-100 rounded-[40px] overflow-hidden shadow-2xl relative">
                <img 
                  src="https://images.dog.ceo/breeds/retriever-golden/n02099601_3073.jpg"
                  alt="Chicago Dog" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur p-6 rounded-3xl shadow-lg border border-white/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-chicago-blue rounded-full flex items-center justify-center text-white">
                        <DogIcon size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">LinkedIn Badge</p>
                        <p className="text-xs text-slate-500">Earned after donation</p>
                      </div>
                    </div>
                    <Award className="text-chicago-blue" size={24} />
                  </div>
                  <p className="text-sm text-slate-600 italic">"I donated to ChiPaws and got a certificate for my LinkedIn profile!"</p>
                </div>
              </div>
              {/* Chicago Stars */}
              <div className="absolute -bottom-6 -left-6 flex gap-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="text-chicago-red">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Impact Stats */}
        <section id="mission" className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <h3 className="text-4xl font-bold text-slate-900 mb-4">Our Impact So Far</h3>
              <p className="text-slate-500 max-w-2xl mx-auto">
                We measure our success by the wagging tails and the community that supports them.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <ImpactCard 
                icon={<DogIcon size={32} />} 
                title="1,200+" 
                subtitle="Puppies Found Homes" 
                description="Since our launch, we've facilitated over a thousand successful adoptions across the city."
              />
              <ImpactCard 
                icon={<Building2 size={32} />} 
                title="15+" 
                subtitle="Shelters Affected" 
                description="We partner with shelters from Lincoln Park to South Side to maximize our reach."
              />
              <ImpactCard 
                icon={<Users size={32} />} 
                title="12% More" 
                subtitle="Likely to Get Hired" 
                description="Studies show that showcasing social impact on your LinkedIn can increase recruiter interest by 12%."
              />
            </div>
          </div>
        </section>

        {/* Why Donate Section */}
        <section className="py-24 px-4 bg-white">
          <div className="max-w-5xl mx-auto bg-chicago-blue rounded-[40px] p-12 md:p-20 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="relative z-10">
              <h3 className="text-4xl md:text-5xl font-bold mb-8">Why should you donate?</h3>
              <p className="text-xl md:text-2xl opacity-90 mb-12 leading-relaxed">
                "Well, if our cuteness hasn't inspired you just yet... did you know that adding a ChiPaws certification to your LinkedIn profile makes you 12% more likely to get hired? Recruiters love seeing community involvement!"
              </p>
              <button 
                onClick={() => setShowDonationModal(true)}
                className="bg-white text-chicago-blue px-10 py-5 rounded-2xl font-bold text-xl hover:bg-slate-100 transition-all shadow-2xl"
              >
                Start Your Impact Journey
              </button>
            </div>
          </div>
        </section>

        {/* Map Section */}
        <section id="map" className="py-24 px-4 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div>
                <h3 className="text-4xl font-bold text-slate-900 mb-4">Discover Chicago Shelters</h3>
                <p className="text-slate-600">Real-time data from OpenStreetMap & Overpass API.</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <div className="w-3 h-3 bg-chicago-blue rounded-full" />
                  Shelter
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <div className="w-3 h-3 bg-chicago-red rounded-full" />
                  Dog Available
                </div>
              </div>
            </div>

            <div className="h-[600px] rounded-[40px] overflow-hidden shadow-2xl border-8 border-white relative">
              {loadingMap && (
                <div className="absolute inset-0 z-20 bg-slate-100 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 border-4 border-chicago-blue border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-slate-500 font-medium">Fetching Chicago Map Data...</p>
                </div>
              )}
              <MapContainer 
                center={[41.8781, -87.6298]} 
                zoom={11} 
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Real Shelters from Overpass */}
                {shelters.map((shelter, idx) => (
                  <Marker 
                    key={idx} 
                    position={[
                      shelter.lat || shelter.center?.lat, 
                      shelter.lon || shelter.center?.lon
                    ]}
                  >
                    <Popup>
                      <div className="p-2">
                        <h4 className="font-bold text-slate-900">{shelter.tags.name || "Unnamed Shelter"}</h4>
                        <p className="text-xs text-slate-500 mb-2">{shelter.tags['addr:street'] || "Chicago, IL"}</p>
                        <button className="text-chicago-blue text-xs font-bold hover:underline">View Dogs Here</button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                
                {/* Real Dog Pins from Petfinder */}
                {realDogs.map((dog) => (
                  <Marker 
                    key={dog.id} 
                    position={[41.8781 + (dog.location.y - 50) * 0.002, -87.6298 + (dog.location.x - 50) * 0.002]}
                    icon={L.divIcon({
                      className: 'custom-div-icon',
                      html: `<div style="background-color: #FF0000; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.2);"></div>`,
                      iconSize: [12, 12],
                      iconAnchor: [6, 6]
                    })}
                  >
                    <Popup>
                      <div className="w-48">
                        <img src={dog.photo} alt={dog.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                        <h4 className="font-bold text-slate-900">{dog.name}</h4>
                        <p className="text-xs text-slate-500 mb-2">{dog.breed}</p>
                        <button 
                          onClick={() => setSelectedDog(dog)}
                          className="w-full bg-chicago-blue text-white py-1 rounded text-xs font-bold"
                        >
                          Meet {dog.name}
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </section>
        </>
      ) : (
        <section className="py-24 px-4 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-bold text-slate-900 mb-4">Meet Our Puppies</h2>
              <p className="text-slate-600 text-lg">These little ones are looking for their forever homes and your support.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {PUPPIES.map((puppy) => (
                <motion.div 
                  key={puppy.id}
                  whileHover={{ y: -10 }}
                  className="bg-white rounded-[32px] overflow-hidden shadow-xl border border-slate-100 flex flex-col"
                >
                  <div className="h-64 relative overflow-hidden">
                    <img 
                      src={puppy.photo} 
                      alt={puppy.name} 
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-chicago-blue">
                      {puppy.age}
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h4 className="text-2xl font-bold text-slate-900 mb-1">{puppy.name}</h4>
                    <p className="text-slate-500 text-sm mb-4">{puppy.breed}</p>
                    <p className="text-slate-600 text-sm mb-6 line-clamp-2">{puppy.description}</p>
                    <button 
                      onClick={() => setShowDonationModal(puppy)}
                      className="mt-auto w-full bg-chicago-blue text-white font-bold py-3 rounded-2xl hover:bg-sky-500 transition-all flex items-center justify-center gap-2"
                    >
                      <Heart size={16} />
                      Donate to {puppy.name}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-20 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <DogIcon className="text-chicago-blue" size={32} />
              <span className="text-2xl font-bold">ChiPaws</span>
            </div>
            <p className="text-slate-400 max-w-sm mb-8">
              A social impact project dedicated to improving the lives of Chicago's rescue dogs through community support and technology.
            </p>
            <div className="flex gap-4">
              <button className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-chicago-blue transition-colors">
                <Share2 size={18} />
              </button>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-6">Quick Links</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Our Mission</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Adopt a Dog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Shelter Partners</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Volunteer</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Legal</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Donation FAQ</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          © 2026 ChiPaws Chicago. Built for the Social Impact Hackathon.
        </div>
      </footer>

      {/* Modals (Dog Profile, Donation, Badge) - Same as before but updated for Stripe */}
      <AnimatePresence>
        {selectedDog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDog(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative z-10"
            >
              <button 
                onClick={() => setSelectedDog(null)}
                className="absolute top-4 right-4 z-20 bg-white/80 backdrop-blur p-2 rounded-full hover:bg-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="grid md:grid-cols-2">
                <div className="h-64 md:h-full relative">
                  <img src={selectedDog.photo} alt={selectedDog.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="p-8">
                  <h3 className="text-3xl font-bold text-slate-900 mb-1">{selectedDog.name}</h3>
                  <p className="text-chicago-blue font-medium mb-6">{selectedDog.breed}</p>
                  <p className="text-slate-600 text-sm leading-relaxed mb-8">{selectedDog.description}</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleAdopt(selectedDog)}
                      className="flex-1 bg-chicago-blue text-white font-bold py-3 rounded-2xl hover:bg-sky-500 transition-all flex items-center justify-center gap-2"
                    >
                      Adopt Me
                    </button>
                    <button 
                      onClick={() => { setSelectedDog(null); setShowDonationModal(selectedDog); }}
                      className="px-4 bg-slate-100 text-slate-700 font-bold py-3 rounded-2xl hover:bg-slate-200 transition-all"
                    >
                      Donate
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDonationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDonationModal(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 relative z-10 text-center">
              <button onClick={() => setShowDonationModal(null)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors"><X size={20} /></button>
              
              <div className="flex justify-center mb-6">
                <svg width="80" height="33" viewBox="0 0 80 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M79.1 16.5C79.1 25.6 71.7 33 62.6 33C53.5 33 46.1 25.6 46.1 16.5C46.1 7.4 53.5 0 62.6 0C71.7 0 79.1 7.4 79.1 16.5ZM52.6 16.5C52.6 22 57.1 26.5 62.6 26.5C68.1 26.5 72.6 22 72.6 16.5C72.6 11 68.1 6.5 62.6 6.5C57.1 6.5 52.6 11 52.6 16.5Z" fill="#635BFF"/>
                  <path d="M36.1 16.5C36.1 25.6 28.7 33 19.6 33C10.5 33 3.1 25.6 3.1 16.5C3.1 7.4 10.5 0 19.6 0C28.7 0 36.1 7.4 36.1 16.5ZM9.6 16.5C9.6 22 14.1 26.5 19.6 26.5C25.1 26.5 29.6 22 29.6 16.5C29.6 11 25.1 6.5 19.6 6.5C14.1 6.5 9.6 11 9.6 16.5Z" fill="#635BFF"/>
                  <path d="M43.1 1.5V31.5H36.1V1.5H43.1Z" fill="#635BFF"/>
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-slate-900 mb-2">Donate to {showDonationModal.name}</h3>
              <p className="text-slate-500 text-sm mb-8">Choose an amount to help {showDonationModal.name} find a forever home.</p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[5, 10, 25].map(amount => (
                  <button key={amount} onClick={() => handleStripeDonate(amount)} className="border-2 border-slate-100 hover:border-chicago-blue hover:bg-sky-50 py-4 rounded-2xl transition-all group">
                    <span className="block text-2xl font-bold text-slate-900 group-hover:text-chicago-blue">${amount}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">Secure Stripe checkout. You'll receive a LinkedIn badge after payment.</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessScreen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSuccessScreen(null)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }} 
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-12 relative z-10 text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
                <ShieldCheck size={40} />
              </div>
              <h3 className="text-4xl font-bold text-slate-900 mb-4">You're officially a ChiPaws supporter!</h3>
              <p className="text-xl text-slate-600 mb-12">
                Thank you so much for your generous donation of ${showSuccessScreen.amount} to help {showSuccessScreen.dogName}. Your support directly impacts the lives of Chicago's rescue dogs.
              </p>

              <div className="bg-slate-50 p-8 rounded-[32px] border-2 border-dashed border-slate-200 mb-12">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-32 h-32 bg-chicago-blue/10 text-chicago-blue rounded-full flex items-center justify-center flex-shrink-0">
                    <Award size={64} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-2xl font-bold text-slate-900 mb-2">Impact Badge: Dog Supporter</h4>
                    <p className="text-slate-500 mb-4 text-sm">Copy this link to showcase your support on your LinkedIn profile or share it with your network.</p>
                    <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
                      <code className="text-xs text-chicago-blue font-mono truncate flex-1">
                        {window.location.origin}/impact/{user?.uid || 'guest'}
                      </code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/impact/${user?.uid || 'guest'}`);
                          alert('Link copied to clipboard!');
                        }}
                        className="text-slate-400 hover:text-chicago-blue transition-colors"
                      >
                        <Share2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => window.open('https://linkedin.com', '_blank')}
                  className="flex-1 bg-[#0077b5] text-white font-bold py-5 rounded-2xl hover:bg-[#006097] transition-all flex items-center justify-center gap-3 text-lg"
                >
                  <Users size={24} />
                  Go to LinkedIn
                </button>
                <button 
                  onClick={() => setShowSuccessScreen(null)}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-5 rounded-2xl hover:bg-slate-200 transition-all text-lg"
                >
                  Back to Home
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBadgeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBadgeModal(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 relative z-10 text-center overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-chicago-blue" />
              <div className="w-24 h-24 bg-chicago-blue/10 text-chicago-blue rounded-full flex items-center justify-center mx-auto mb-6 animate-float"><Award size={48} /></div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">You're a {showBadgeModal.type}!</h3>
              <p className="text-slate-500 text-sm mb-8">Thank you for your impact! You are now eligible to add this achievement to your LinkedIn profile.</p>
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 mb-8">
                <div className="py-4 px-6 bg-white rounded-xl shadow-sm inline-block border border-slate-100">
                  <p className="text-chicago-blue font-bold text-lg">{showBadgeModal.type}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">ChiPaws Social Impact</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={() => addToLinkedIn(showBadgeModal.type!)} className="w-full bg-[#0077b5] text-white font-bold py-4 rounded-2xl hover:bg-[#006097] transition-all flex items-center justify-center gap-2">
                  Add to LinkedIn Profile
                </button>
                <button onClick={() => setShowBadgeModal(null)} className="w-full text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors">Maybe Later</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ImpactCard({ icon, title, subtitle, description }: { icon: React.ReactNode; title: string; subtitle: string; description: string }) {
  return (
    <div className="bg-white p-10 rounded-[40px] shadow-xl border border-slate-100 hover:translate-y-[-8px] transition-all duration-300">
      <div className="w-16 h-16 rounded-2xl bg-chicago-blue/10 text-chicago-blue flex items-center justify-center mb-8">
        {icon}
      </div>
      <h4 className="text-4xl font-bold text-slate-900 mb-2">{title}</h4>
      <p className="text-lg font-bold text-chicago-blue mb-4">{subtitle}</p>
      <p className="text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}
