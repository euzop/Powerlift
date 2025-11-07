import { useState, useEffect, useCallback } from 'react';
import PowerLiftAPI from '../services/api';
import useAuth from './useAuth';

// Define progress entry type
export interface ProgressEntry {
  exercise_type: string;
  date: string;
  score: number;
  weight_used?: string;
  body_weight?: string;
  notes?: string;
  timestamp?: string;
}

export default function useProgress() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<ProgressEntry[]>([]);
  const { user } = useAuth();

  // Fetch all progress data
  const fetchProgressData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await PowerLiftAPI.getUserProgress();
      setProgressData(response.progress || []);
    } catch (err) {
      console.error('Failed to fetch progress data:', err);
      setError('Failed to load progress data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch progress data for a specific exercise
  const fetchProgressByExercise = useCallback(async (exerciseType: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await PowerLiftAPI.getUserProgress(exerciseType);
      return response.progress || [];
    } catch (err) {
      console.error(`Failed to fetch progress data for ${exerciseType}:`, err);
      setError(`Failed to load ${exerciseType} progress data. Please try again.`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Add a new progress entry
  const addProgressEntry = useCallback(async (entry: ProgressEntry) => {
    if (!user) return null;
    
    try {
      setLoading(true);
      setError(null);
      const response = await PowerLiftAPI.addProgressEntry(entry);
      
      // Update local data
      setProgressData(prev => [...prev, entry]);
      
      return response.entry;
    } catch (err) {
      console.error('Failed to add progress entry:', err);
      setError('Failed to save progress data. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load initial data when the hook is first used
  useEffect(() => {
    if (user) {
      fetchProgressData();
    }
  }, [user, fetchProgressData]);

  return {
    loading,
    error,
    progressData,
    fetchProgressData,
    fetchProgressByExercise,
    addProgressEntry
  };
} 