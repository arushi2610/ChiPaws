/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Twitter, 
  MessageCircle, 
  ExternalLink, 
  Menu, 
  X,
  ChevronRight,
  Heart,
  Sparkles,
  Coins,
  Users,
  BookOpen,
  MapPin,
  Dog as DogIcon,
  Award,
  ShieldCheck,
  Building2,
  Linkedin,
  Instagram,
  User as UserIcon,
  Plus,
  Trash2
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { auth } from './firebase';
import { DOGS } from './data/dogs';
import { PUPPIES } from './data/puppies';
import { Dog } from './types';

import ShelterMap from './components/ShelterMap';

const BRAND_BUDDY = "https://images.pexels.com/photos/36568309/pexels-photo-36568309.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'discover' | 'puppies' | 'shelters'>('discover');
  const [showDonationModal, setShowDonationModal] = useState<Dog | null>(null);
  const [showSuccessScreen, setShowSuccessScreen] = useState<{ amount: number; dogName: string; certId: string } | null>(null);
  const [displayPuppies, setDisplayPuppies] = useState<Dog[]>(PUPPIES);
  const [viewingCert, setViewingCert] = useState<{ id: string; name: string; amount: number; dogName: string } | null>(null);
  const [totalDonated, setTotalDonated] = useState(0);
  const [myPets, setMyPets] = useState<{name: string, age: string}[]>([
    { name: "Buddy", age: "3 years" }
  ]);
  const [showProfile, setShowProfile] = useState(false);
  const [newPet, setNewPet] = useState({ name: "", age: "" });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    bio: "Chicago local & dog lover. Passionate about helping rescue pups find their forever homes!",
    neighborhood: "Wicker Park",
    linkedin: "https://linkedin.com",
    twitter: "https://twitter.com",
    instagram: "https://instagram.com",
    photoURL: ""
  });

  useEffect(() => {
    // Check for certificate in URL
    const params = new URLSearchParams(window.location.search);
    const certId = params.get('cert');
    if (certId) {
      // For demo purposes, we'll "reconstruct" a cert from params or use mock data
      // In a real app, we'd fetch this from Firestore
      setViewingCert({
        id: certId,
        name: params.get('name') || "Puppy Furrs",
        amount: Number(params.get('amount')) || 25,
        dogName: params.get('dog') || "a brave pup"
      });
    }
  }, []);

  useEffect(() => {
    const fetchDogImages = async () => {
      try {
        const response = await fetch(`https://dog.ceo/api/breeds/image/random/${PUPPIES.length}`);
        const data = await response.json();
        if (data.status === 'success') {
          const updatedPuppies = PUPPIES.map((puppy, index) => ({
            ...puppy,
            photo: data.message[index] || puppy.photo
          }));
          setDisplayPuppies(updatedPuppies);
        }
      } catch (error) {
        console.error("Error fetching dog images:", error);
      }
    };
    fetchDogImages();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

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

  const handleDonate = (amount: number) => {
    if (!showDonationModal) return;
    const dogName = showDonationModal.name;
    const certId = Math.random().toString(36).substring(2, 15);
    setTotalDonated(prev => prev + amount);
    setShowDonationModal(null);
    setShowSuccessScreen({ amount, dogName, certId });
  };

  const handleSaveProfile = () => {
    setIsEditingProfile(false);
    // In a real app, we'd save to Firestore here
  };

  const shareOnTwitter = (certId: string, amount: number) => {
    const text = `I just donated $${amount} to help a pup at ChiPaws! Check out my certificate:`;
    const url = `${window.location.origin}/?cert=${certId}&name=${encodeURIComponent(user?.displayName || "Puppy Furrs")}&amount=${amount}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const shareOnLinkedIn = (certId: string, amount: number) => {
    const url = `${window.location.origin}/?cert=${certId}&name=${encodeURIComponent(user?.displayName || "Puppy Furrs")}&amount=${amount}`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
  };

  const copyCertLink = (certId: string, amount: number) => {
    const url = `${window.location.origin}/?cert=${certId}&name=${encodeURIComponent(user?.displayName || "Puppy Furrs")}&amount=${amount}`;
    navigator.clipboard.writeText(url);
    alert("Certificate link copied to clipboard! Share it on Instagram or anywhere else.");
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData(prev => ({ ...prev, photoURL: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const NavLink = ({ onClick, children, active }: { onClick: () => void; children: React.ReactNode; active?: boolean }) => (
    <button 
      onClick={onClick}
      className={`font-bangers text-2xl hover:text-chipaws-yellow transition-colors tracking-wider ${active ? 'text-chipaws-blue' : ''}`}
    >
      {children}
    </button>
  );

  if (viewingCert) {
    return (
      <div className="min-h-screen bg-chipaws-cream flex items-center justify-center p-6">
        <div className="absolute inset-0 sunburst opacity-10 animate-rotate-slow" />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white border-8 border-black rounded-[50px] p-12 max-w-3xl w-full relative z-10 shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] text-center"
        >
          <div className="flex justify-between items-start mb-12">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 bg-chipaws-blue rounded-full flex items-center justify-center text-white border-2 border-black">
                <DogIcon size={28} />
              </div>
              <span className="font-display text-4xl text-stroke-sm">CHIPAWS</span>
            </div>
            <div className="font-bangers text-xl text-slate-400">CERTIFICATE ID: {viewingCert.id}</div>
          </div>

          <h1 className="font-display text-6xl md:text-8xl mb-8 uppercase text-stroke-sm">HERO AWARD</h1>
          
          <div className="space-y-6 mb-12">
            <p className="font-bangers text-3xl text-slate-500 tracking-widest">THIS CERTIFIES THAT</p>
            <p className="font-display text-5xl md:text-7xl text-chipaws-blue">{viewingCert.name}</p>
            <p className="font-sans text-2xl text-slate-600 leading-relaxed">
              has generously donated <span className="font-bold text-black">${viewingCert.amount}</span> to support <span className="font-bold text-black">{viewingCert.dogName}</span> and the Chicago rescue community.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-6 justify-center pt-8 border-t-4 border-black/5">
            <button 
              onClick={() => {
                window.history.replaceState({}, document.title, "/");
                setViewingCert(null);
              }} 
              className="pill-button bg-black text-white text-xl"
            >
              VISIT CHIPAWS
            </button>
            <button 
              onClick={() => window.print()}
              className="pill-button bg-chipaws-yellow text-black text-xl"
            >
              PRINT CERTIFICATE
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-chipaws-cream overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between bg-white/80 backdrop-blur-md border-4 border-black rounded-full px-8 py-3 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-chipaws-blue rounded-full flex items-center justify-center text-white border-2 border-black">
              <DogIcon size={24} />
            </div>
            <span className="font-display text-3xl text-stroke-sm">CHIPAWS</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <NavLink onClick={() => setActiveTab('discover')} active={activeTab === 'discover'}>DISCOVER</NavLink>
            <NavLink onClick={() => setActiveTab('puppies')} active={activeTab === 'puppies'}>PUPPIES</NavLink>
            <NavLink onClick={() => setActiveTab('shelters')} active={activeTab === 'shelters'}>SHELTERS</NavLink>
          </div>

          <div className="flex items-center gap-4">
            {isAuthReady && (
              user ? (
                <div className="hidden md:flex items-center gap-3">
                  <button 
                    onClick={() => setShowProfile(true)}
                    className="flex items-center gap-2 hover:bg-chipaws-blue/10 p-2 rounded-full transition-colors"
                  >
                    <img src={profileData.photoURL || user.photoURL || ''} className="w-8 h-8 rounded-full border-2 border-black object-cover" alt="User" />
                    <span className="font-bangers text-xl">MY PROFILE</span>
                  </button>
                  <button onClick={logout} className="font-bangers text-xl hover:text-red-500">LOGOUT</button>
                </div>
              ) : (
                <button onClick={login} className="hidden md:block font-bangers text-xl hover:text-chipaws-blue">LOGIN</button>
              )
            )}
            <button 
              onClick={() => setShowDonationModal(displayPuppies[0])}
              className="pill-button bg-chipaws-yellow text-black text-xl"
            >
              DONATE
            </button>
            <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={32} /> : <Menu size={32} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-chipaws-cream pt-24 px-8 flex flex-col gap-8 items-center"
          >
            <NavLink onClick={() => { setActiveTab('discover'); setIsMenuOpen(false); }}>DISCOVER</NavLink>
            <NavLink onClick={() => { setActiveTab('puppies'); setIsMenuOpen(false); }}>PUPPIES</NavLink>
            <NavLink onClick={() => { setActiveTab('shelters'); setIsMenuOpen(false); }}>SHELTERS</NavLink>
            {user ? (
              <button onClick={logout} className="font-bangers text-3xl">LOGOUT</button>
            ) : (
              <button onClick={login} className="font-bangers text-3xl">LOGIN</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'discover' ? (
        <>
          {/* Hero Section */}
          <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 overflow-hidden">
            <div className="absolute inset-0 sunburst opacity-20 animate-rotate-slow" />
            
            <div className="relative z-10 text-center px-4">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 12 }}
              >
                <h1 className="font-display text-7xl md:text-9xl text-white text-stroke mb-2 drop-shadow-[10px_10px_0px_rgba(0,0,0,1)]">
                  CHIPAWS
                </h1>
                <p className="font-bangers text-3xl md:text-5xl text-chipaws-blue text-stroke-sm mb-12 tracking-widest">
                  CHICAGO'S BRAVEST DOGS
                </p>
              </motion.div>

              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-chipaws-yellow rounded-full blur-3xl opacity-30 scale-150" />
                <img 
                  src={BRAND_BUDDY} 
                  alt="ChiPaws Buddy" 
                  className="w-64 h-64 md:w-96 md:h-96 object-cover rounded-full border-8 border-black shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] mx-auto relative z-10"
                  referrerPolicy="no-referrer"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 flex flex-col md:flex-row gap-6 justify-center"
              >
                <button 
                  onClick={() => setActiveTab('puppies')}
                  className="pill-button bg-chipaws-blue text-white text-2xl px-12"
                >
                  MEET THE PUPS
                </button>
                <button 
                  onClick={() => setShowDonationModal(displayPuppies[0])}
                  className="pill-button bg-white text-black text-2xl px-12"
                >
                  SUPPORT US
                </button>
              </motion.div>
            </div>
          </section>

          {/* Impact Section */}
          <section className="py-24 px-6 relative">
            <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
              <ImpactCard 
                icon={<DogIcon size={40} />}
                title="1,200+"
                subtitle="DOGS SAVED"
                description="We've helped over a thousand Chicago pups find their forever homes since we started."
              />
              <ImpactCard 
                icon={<Building2 size={40} />}
                title="15+"
                subtitle="SHELTERS"
                description="Partnering with local shelters across the city to maximize our impact."
              />
              <ImpactCard 
                icon={<Award size={40} />}
                title="12% BOOST"
                subtitle="CAREER IMPACT"
                description="Showcasing your support on LinkedIn makes you 12% more likely to get hired!"
              />
            </div>
          </section>

          {/* Story Section */}
          <section className="py-24 px-6 bg-chipaws-blue/10">
            <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-black rounded-[40px] translate-x-4 translate-y-4" />
                <img 
                  src="https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                  alt="Chicago Rescue" 
                  className="w-full h-[500px] object-cover rounded-[40px] border-4 border-black relative z-10"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h2 className="font-display text-5xl md:text-7xl mb-8 text-stroke-sm uppercase">Our Mission</h2>
                <p className="font-sans text-xl md:text-2xl leading-relaxed mb-8">
                  ChiPaws is on a mission to empty Chicago's shelters. We believe every dog deserves a warm bed and a loving family. Through community support and technology, we're making that a reality.
                </p>
                <button className="pill-button bg-chipaws-yellow text-black text-2xl flex items-center gap-2">
                  JOIN THE PACK <ChevronRight />
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-display text-6xl md:text-8xl text-center mb-16 text-stroke-sm">THE PUPPIES</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {displayPuppies.map((puppy) => (
                <motion.div 
                  key={puppy.id}
                  whileHover={{ y: -10 }}
                  className="bg-white border-4 border-black rounded-[40px] overflow-hidden shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] flex flex-col"
                >
                  <div className="h-72 relative">
                    <img src={puppy.photo} alt={puppy.name} className="w-full h-full object-cover border-b-4 border-black" referrerPolicy="no-referrer" />
                    <div className="absolute top-4 left-4 bg-chipaws-yellow border-2 border-black px-4 py-1 rounded-full font-bold">
                      {puppy.age}
                    </div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col">
                    <h3 className="font-display text-4xl mb-2 uppercase">{puppy.name}</h3>
                    <p className="font-sans text-lg text-slate-600 mb-8 flex-1">{puppy.description}</p>
                    <button 
                      onClick={() => setShowDonationModal(puppy)}
                      className="pill-button bg-chipaws-red text-white text-xl w-full flex items-center justify-center gap-2"
                    >
                      <Heart size={20} /> DONATE TO {puppy.name}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'shelters' && (
        <section className="py-24 px-6 bg-chipaws-cream">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
              <div className="max-w-2xl">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  className="inline-flex items-center gap-2 bg-chipaws-blue/10 text-chipaws-blue px-4 py-2 rounded-full font-bangers text-xl tracking-widest mb-6 border-2 border-chipaws-blue/20"
                >
                  <MapPin size={20} /> CHICAGO RESCUE NETWORK
                </motion.div>
                <h2 className="font-display text-6xl md:text-8xl leading-[0.9] uppercase">
                  FIND <span className="text-chipaws-blue">SHELTERS</span> & PARKS
                </h2>
              </div>
              <p className="font-sans text-xl text-slate-600 max-w-sm">
                Explore our interactive map to find adoptable dogs, local shelters, dog parks, and pet stores across the city.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <ShelterMap />
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 mt-24">
              <div className="bg-white border-4 border-black p-8 rounded-[32px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="w-16 h-16 bg-chipaws-red/10 rounded-2xl flex items-center justify-center mb-6 border-2 border-black">
                  <Heart className="text-chipaws-red" size={32} />
                </div>
                <h4 className="font-display text-3xl mb-4 uppercase">Direct Donation</h4>
                <p className="font-sans text-slate-600 mb-6">Many shelters on the map accept direct donations of food, toys, and blankets. Check their pins for details.</p>
              </div>
              <div className="bg-white border-4 border-black p-8 rounded-[32px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="w-16 h-16 bg-chipaws-blue/10 rounded-2xl flex items-center justify-center mb-6 border-2 border-black">
                  <Users size={32} />
                </div>
                <h4 className="font-display text-3xl mb-4 uppercase">Volunteer</h4>
                <p className="font-sans text-slate-600 mb-6">Interested in helping out? Use the shelter contact info to inquire about volunteer opportunities near you.</p>
              </div>
              <div className="bg-white border-4 border-black p-8 rounded-[32px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="w-16 h-16 bg-chipaws-yellow/10 rounded-2xl flex items-center justify-center mb-6 border-2 border-black">
                  <Award size={32} />
                </div>
                <h4 className="font-display text-3xl mb-4 uppercase">Pet Events</h4>
                <p className="font-sans text-slate-600 mb-6">Chicago dog parks often host adoption events and meetups. Keep an eye on the green pins!</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProfile(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white border-4 border-black rounded-[40px] p-8 md:p-12 max-w-2xl w-full relative z-10 shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] overflow-y-auto max-h-[90vh]">
              <button onClick={() => setShowProfile(false)} className="absolute top-6 right-6 hover:rotate-90 transition-transform"><X size={32} /></button>
              
              <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
                <div className="relative group">
                  <img src={profileData.photoURL || user?.photoURL || ''} className="w-32 h-32 rounded-full border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] object-cover" alt="Profile" />
                  {isEditingProfile && (
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="text-white" size={32} />
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                    </label>
                  )}
                </div>
                <div className="text-center md:text-left flex-1">
                  <h3 className="font-display text-4xl mb-2 uppercase">{user?.displayName || "Puppy Furrs"}</h3>
                  <div className="flex gap-4 justify-center md:justify-start mb-4">
                    <a href={profileData.linkedin} target="_blank" rel="noreferrer"><Linkedin className="hover:text-chipaws-blue cursor-pointer" /></a>
                    <a href={profileData.twitter} target="_blank" rel="noreferrer"><Twitter className="hover:text-chipaws-blue cursor-pointer" /></a>
                    <a href={profileData.instagram} target="_blank" rel="noreferrer"><Instagram className="hover:text-chipaws-blue cursor-pointer" /></a>
                  </div>
                  {!isEditingProfile && (
                    <button 
                      onClick={() => setIsEditingProfile(true)}
                      className="text-chipaws-blue font-bangers text-xl hover:underline"
                    >
                      EDIT PROFILE
                    </button>
                  )}
                </div>
              </div>

              {isEditingProfile ? (
                <div className="space-y-6 mb-12">
                  <div>
                    <label className="font-bangers text-xl text-chipaws-blue block mb-2">BIO</label>
                    <textarea 
                      value={profileData.bio}
                      onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                      className="w-full border-2 border-black p-3 rounded-xl font-sans h-24"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="font-bangers text-xl text-chipaws-blue block mb-2">NEIGHBORHOOD</label>
                      <input 
                        type="text"
                        value={profileData.neighborhood}
                        onChange={(e) => setProfileData({...profileData, neighborhood: e.target.value})}
                        className="w-full border-2 border-black p-3 rounded-xl font-sans"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="font-bangers text-xl text-chipaws-blue block mb-2">LINKEDIN URL</label>
                      <input 
                        type="text"
                        value={profileData.linkedin}
                        onChange={(e) => setProfileData({...profileData, linkedin: e.target.value})}
                        className="w-full border-2 border-black p-3 rounded-xl font-sans"
                      />
                    </div>
                    <div>
                      <label className="font-bangers text-xl text-chipaws-blue block mb-2">X (TWITTER) URL</label>
                      <input 
                        type="text"
                        value={profileData.twitter}
                        onChange={(e) => setProfileData({...profileData, twitter: e.target.value})}
                        className="w-full border-2 border-black p-3 rounded-xl font-sans"
                      />
                    </div>
                    <div>
                      <label className="font-bangers text-xl text-chipaws-blue block mb-2">INSTAGRAM URL</label>
                      <input 
                        type="text"
                        value={profileData.instagram}
                        onChange={(e) => setProfileData({...profileData, instagram: e.target.value})}
                        className="w-full border-2 border-black p-3 rounded-xl font-sans"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={handleSaveProfile} className="pill-button bg-chipaws-yellow text-black flex-1">SAVE CHANGES</button>
                    <button onClick={() => setIsEditingProfile(false)} className="pill-button bg-slate-200 text-black flex-1">CANCEL</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 mb-12">
                  <div className="bg-slate-50 border-2 border-black p-4 rounded-2xl">
                    <p className="font-sans text-lg italic text-slate-600">"{profileData.bio}"</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="text-chipaws-blue" size={20} />
                      <span className="font-bangers text-xl">{profileData.neighborhood}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DogIcon className="text-chipaws-blue" size={20} />
                      <span className="font-bangers text-xl">{profileData.favoriteBreed}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-8 mb-12">
                <div className="bg-chipaws-yellow/20 border-4 border-black p-6 rounded-3xl">
                  <p className="font-bangers text-2xl text-chipaws-blue mb-2 tracking-widest uppercase">Total Donated</p>
                  <p className="font-display text-5xl">${totalDonated}</p>
                </div>
                <div className="bg-chipaws-blue/10 border-4 border-black p-6 rounded-3xl">
                  <p className="font-bangers text-2xl text-chipaws-blue mb-2 tracking-widest uppercase">Hero Level</p>
                  <p className="font-display text-4xl">{totalDonated > 100 ? "LEGEND" : totalDonated > 50 ? "ELITE" : "ROOKIE"}</p>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="font-display text-3xl mb-4 uppercase">My Pack ({myPets.length})</h4>
                <div className="space-y-3 mb-6">
                  {myPets.map((pet, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white border-2 border-black p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <div>
                        <p className="font-display text-xl uppercase">{pet.name}</p>
                        <p className="font-sans text-sm text-slate-500">{pet.age}</p>
                      </div>
                      <button onClick={() => setMyPets(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:scale-110">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 border-2 border-black p-6 rounded-3xl space-y-4">
                  <p className="font-bangers text-xl text-chipaws-blue tracking-widest">ADD A NEW PUP</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      value={newPet.name}
                      onChange={(e) => setNewPet({...newPet, name: e.target.value})}
                      placeholder="Name"
                      className="border-2 border-black p-3 rounded-xl font-sans"
                    />
                    <input 
                      type="text" 
                      value={newPet.age}
                      onChange={(e) => setNewPet({...newPet, age: e.target.value})}
                      placeholder="Age"
                      className="border-2 border-black p-3 rounded-xl font-sans"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      if (newPet.name && newPet.age) {
                        setMyPets(prev => [...prev, newPet]);
                        setNewPet({ name: "", age: "" });
                      }
                    }}
                    className="w-full bg-chipaws-yellow border-2 border-black p-4 rounded-xl font-bangers text-2xl hover:scale-[1.02] transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
                  >
                    ADD TO MY PACK
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-12 px-6 border-t-4 border-black bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-chipaws-blue rounded-full flex items-center justify-center text-white border-2 border-black">
              <DogIcon size={28} />
            </div>
            <span className="font-display text-4xl text-stroke-sm">CHIPAWS</span>
          </div>
          <p className="font-sans font-bold text-slate-500">
            © 2026 CHIPAWS CHICAGO. ALL RIGHTS RESERVED.
          </p>
          <div className="flex gap-6">
            <Twitter className="hover:text-chipaws-blue cursor-pointer" />
            <MessageCircle className="hover:text-chipaws-blue cursor-pointer" />
            <ExternalLink className="hover:text-chipaws-blue cursor-pointer" />
          </div>
        </div>
      </footer>

      {/* Donation Modal */}
      <AnimatePresence>
        {showDonationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDonationModal(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white border-4 border-black rounded-[40px] p-8 md:p-12 max-w-md w-full relative z-10 shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] text-center">
              <button onClick={() => setShowDonationModal(null)} className="absolute top-6 right-6 hover:rotate-90 transition-transform"><X size={32} /></button>
              <h3 className="font-display text-4xl mb-4 uppercase">SUPPORT {showDonationModal.name}</h3>
              <p className="font-sans text-xl text-slate-600 mb-8">Choose an amount to help this brave pup find a home!</p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[5, 10, 25].map(amount => (
                  <button 
                    key={amount} 
                    onClick={() => handleDonate(amount)}
                    className="border-4 border-black hover:bg-chipaws-yellow p-4 rounded-2xl transition-colors group"
                  >
                    <span className="block font-display text-3xl">${amount}</span>
                  </button>
                ))}
              </div>
              <p className="font-sans text-sm text-slate-400 uppercase font-bold">Secure Stripe Checkout</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Screen */}
      <AnimatePresence>
        {showSuccessScreen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSuccessScreen(null)} className="absolute inset-0 bg-chipaws-blue/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="bg-white border-8 border-black rounded-[50px] p-12 max-w-2xl w-full relative z-10 shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] text-center">
              <div className="w-24 h-24 bg-chipaws-yellow border-4 border-black rounded-full flex items-center justify-center mx-auto mb-8">
                <ShieldCheck size={48} />
              </div>
              <h3 className="font-display text-5xl mb-6 uppercase">YOU'RE A HERO!</h3>
              <p className="font-sans text-2xl text-slate-700 mb-12">
                Thank you for donating <span className="font-bold text-chipaws-blue">${showSuccessScreen.amount}</span> to help <span className="font-bold">{showSuccessScreen.dogName}</span>. You're making Chicago a better place!
              </p>
              <div className="flex flex-col items-center gap-8">
                <div className="flex flex-col items-center gap-4">
                  <p className="font-bangers text-xl text-chipaws-blue tracking-widest uppercase">Share Your Impact</p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => shareOnTwitter(showSuccessScreen.certId, showSuccessScreen.amount)}
                      className="w-16 h-16 bg-[#1DA1F2] border-4 border-black rounded-2xl flex items-center justify-center text-white hover:scale-110 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-1 active:translate-y-1"
                      title="Share on X (Twitter)"
                    >
                      <Twitter size={32} />
                    </button>
                    <button 
                      onClick={() => shareOnLinkedIn(showSuccessScreen.certId, showSuccessScreen.amount)}
                      className="w-16 h-16 bg-[#0077B5] border-4 border-black rounded-2xl flex items-center justify-center text-white hover:scale-110 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-1 active:translate-y-1"
                      title="Share on LinkedIn"
                    >
                      <Linkedin size={32} />
                    </button>
                    <button 
                      onClick={() => copyCertLink(showSuccessScreen.certId, showSuccessScreen.amount)}
                      className="w-16 h-16 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] border-4 border-black rounded-2xl flex items-center justify-center text-white hover:scale-110 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-1 active:translate-y-1"
                      title="Share on Instagram"
                    >
                      <Instagram size={32} />
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setShowSuccessScreen(null)} 
                  className="font-bangers text-lg text-slate-400 hover:text-black transition-colors underline underline-offset-4"
                >
                  BACK TO HOME
                </button>
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
    <motion.div 
      whileHover={{ y: -10, rotate: 1 }}
      className="bg-white border-4 border-black p-10 rounded-[40px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group"
    >
      <div className="w-20 h-20 bg-chipaws-blue/10 text-chipaws-blue rounded-2xl border-2 border-black flex items-center justify-center mb-8 relative z-10">
        {icon}
      </div>
      <h4 className="font-display text-5xl mb-2 relative z-10 uppercase">{title}</h4>
      <p className="font-bangers text-2xl text-chipaws-blue mb-4 relative z-10 tracking-widest">{subtitle}</p>
      <p className="font-sans text-xl text-slate-600 leading-relaxed relative z-10">{description}</p>
    </motion.div>
  );
}
