import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { ProgressEntry } from '../hooks/useProgress';
import { fitnessTheme } from '../constants/Colors';

interface ProgressChartProps {
  data: ProgressEntry[];
  title: string;
  color?: string;
}

const ProgressChart: React.FC<ProgressChartProps> = ({ data, title, color = fitnessTheme.primary }) => {
  // Sort data by date
  const sortedData = [...data].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Extract dates and scores
  const dates = sortedData.map(entry => {
    const date = new Date(entry.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });
  
  const scores = sortedData.map(entry => entry.score);
  
  // Calculate statistics
  const averageScore = scores.length > 0 
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
    : 0;
  
  const maxScore = scores.length > 0 
    ? Math.max(...scores) 
    : 0;
    
  const minScore = scores.length > 0 
    ? Math.min(...scores) 
    : 0;
    
  const latestScore = scores.length > 0 
    ? scores[scores.length - 1] 
    : 0;
    
  // If no data, show placeholder
  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No data available for this exercise</Text>
          <Text style={styles.noDataSubtext}>Complete a workout to see your progress</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.chartContainer}>
        <LineChart
          data={{
            labels: dates,
            datasets: [
              {
                data: scores,
                color: () => color,
                strokeWidth: 2
              }
            ],
            legend: ['Form Score']
          }}
          width={Dimensions.get('window').width - 40}
          height={220}
          chartConfig={{
            backgroundColor: fitnessTheme.surface,
            backgroundGradientFrom: fitnessTheme.surface,
            backgroundGradientTo: fitnessTheme.surface,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 230, 118, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: '6',
              strokeWidth: '2',
              stroke: color
            }
          }}
          style={styles.chart}
          bezier
        />
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Average</Text>
          <Text style={styles.statValue}>{averageScore !== undefined && averageScore !== null ? averageScore.toFixed(1) : '0.0'}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Best</Text>
          <Text style={styles.statValue}>{maxScore !== undefined && maxScore !== null ? maxScore.toFixed(1) : '0.0'}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Lowest</Text>
          <Text style={styles.statValue}>{minScore !== undefined && minScore !== null ? minScore.toFixed(1) : '0.0'}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Latest</Text>
          <Text style={[styles.statValue, styles.latestValue]}>{latestScore !== undefined && latestScore !== null ? latestScore.toFixed(1) : '0.0'}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: fitnessTheme.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: fitnessTheme.text,
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 8,
    paddingRight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: fitnessTheme.textMuted,
    fontSize: 14,
    marginBottom: 4,
  },
  statValue: {
    color: fitnessTheme.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  latestValue: {
    color: fitnessTheme.primary,
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    color: fitnessTheme.text,
    fontSize: 18,
    marginBottom: 8,
  },
  noDataSubtext: {
    color: fitnessTheme.textMuted,
    fontSize: 14,
  }
});

export default ProgressChart; 