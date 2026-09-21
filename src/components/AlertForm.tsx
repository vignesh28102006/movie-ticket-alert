'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Movie, Theatre, PlatformType, Alert } from '@/types/database';
import { Film, Calendar, MapPin, Building, Ticket, Phone, Loader2, CheckCircle } from 'lucide-react';

interface AlertFormProps {
  initialAlert?: Alert;
  isEditing?: boolean;
}

const CITIES = ['Coimbatore', 'Chennai', 'Bangalore', 'Hyderabad'];

export function AlertForm({ initialAlert, isEditing = false }: AlertFormProps) {
  const router = useRouter();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [theatres, setTheatres] = useState<Theatre[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [selectedMovieId, setSelectedMovieId] = useState(initialAlert?.movie_id || '');
  const [selectedCity, setSelectedCity] = useState(initialAlert?.city || 'Coimbatore');
  const [selectedTheatreId, setSelectedTheatreId] = useState(initialAlert?.theatre_id || '');
  const [watchDate, setWatchDate] = useState(initialAlert?.watch_date || '2026-09-24');
  const [platform, setPlatform] = useState<PlatformType>(initialAlert?.platform || 'both');
  const [phoneNumber, setPhoneNumber] = useState(initialAlert?.phone_number || '+919876543210');
  const [simulateRelease, setSimulateRelease] = useState(initialAlert?.simulate_release ?? false);

  // Load Movies
  useEffect(() => {
    async function loadData() {
      setIsLoadingMetadata(true);
      try {
        const [moviesRes, theatresRes] = await Promise.all([
          fetch('/api/movies').then((r) => r.json()),
          fetch(`/api/theatres?city=${encodeURIComponent(selectedCity)}`).then((r) => r.json()),
        ]);

        if (moviesRes.success && moviesRes.movies) {
          setMovies(moviesRes.movies);
          if (!selectedMovieId && moviesRes.movies.length > 0) {
            setSelectedMovieId(moviesRes.movies[0].id);
            if (moviesRes.movies[0].release_date) {
              setWatchDate(moviesRes.movies[0].release_date);
            }
          }
        }

        if (theatresRes.success && theatresRes.theatres) {
          setTheatres(theatresRes.theatres);
          if (!selectedTheatreId && theatresRes.theatres.length > 0) {
            setSelectedTheatreId(theatresRes.theatres[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load form metadata:', err);
      } finally {
        setIsLoadingMetadata(false);
      }
    }

    loadData();
  }, [selectedCity]);

  // Handle Movie change
  const handleMovieChange = (movieId: string) => {
    setSelectedMovieId(movieId);
    const movie = movies.find((m) => m.id === movieId);
    if (movie && movie.release_date) {
      setWatchDate(movie.release_date);
    }
  };

  // Handle City change
  const handleCityChange = async (city: string) => {
    setSelectedCity(city);
    try {
      const res = await fetch(`/api/theatres?city=${encodeURIComponent(city)}`).then((r) => r.json());
      if (res.success && res.theatres) {
        setTheatres(res.theatres);
        if (res.theatres.length > 0) {
          setSelectedTheatreId(res.theatres[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch theatres for city:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    // Basic Validation
    if (!selectedMovieId) {
      setErrorMessage('Please select a movie');
      setIsSubmitting(false);
      return;
    }
    if (!selectedTheatreId) {
      setErrorMessage('Please select a theatre');
      setIsSubmitting(false);
      return;
    }
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      setErrorMessage('Please enter a valid phone number starting with country code e.g. +919876543210');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        movie_id: selectedMovieId,
        theatre_id: selectedTheatreId,
        city: selectedCity,
        watch_date: watchDate,
        platform,
        phone_number: phoneNumber,
        simulate_release: simulateRelease,
      };

      const url = isEditing && initialAlert ? `/api/alerts/${initialAlert.id}` : '/api/alerts';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save alert');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingMetadata) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* 1. Movie Selection */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Film className="h-4 w-4 text-rose-400" />
          Select Movie
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {movies.map((movie) => {
            const isSelected = selectedMovieId === movie.id;
            return (
              <button
                key={movie.id}
                type="button"
                onClick={() => handleMovieChange(movie.id)}
                className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-rose-500 bg-rose-950/30 shadow-md shadow-rose-500/10 ring-1 ring-rose-500'
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900'
                }`}
              >
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">{movie.title}</p>
                  <p className="text-xs text-zinc-400">{movie.language} • Rel: {movie.release_date}</p>
                </div>
                {isSelected && <CheckCircle className="h-4 w-4 text-rose-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. City & Theatre */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <MapPin className="h-4 w-4 text-rose-400" />
            City
          </label>
          <select
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          >
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Building className="h-4 w-4 text-rose-400" />
            Theatre / Multiplex
          </label>
          <select
            value={selectedTheatreId}
            onChange={(e) => setSelectedTheatreId(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          >
            {theatres.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Watch Date & Platform */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Calendar className="h-4 w-4 text-rose-400" />
            Watch Date
          </label>
          <input
            type="date"
            value={watchDate}
            onChange={(e) => setWatchDate(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Ticket className="h-4 w-4 text-rose-400" />
            Booking Platform
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'bookmyshow', label: 'BookMyShow' },
              { id: 'district', label: 'District' },
              { id: 'both', label: 'Both' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPlatform(item.id as PlatformType)}
                className={`rounded-xl border py-2 text-xs font-semibold transition ${
                  platform === item.id
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Phone Number for Alerts */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Phone className="h-4 w-4 text-rose-400" />
          Alert Recipient Phone Number
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+919876543210"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          required
        />
        <p className="text-xs text-zinc-500">
          Include country code (+91 for India). You will receive instant notifications when tickets release.
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-amber-600 transition disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{isEditing ? 'Update Alert' : 'Submit Alert'}</span>
        </button>
      </div>
    </form>
  );
}
