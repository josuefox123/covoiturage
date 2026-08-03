import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../../../../src/styles/theme';

interface DateTimeStepProps {
  selectedDateObj: Date;
  time: string;
  seats: number;
  isRecurrent: boolean;
  repeatType: 'single_week' | 'weekly';
  endDateObj: Date;
  selectedDays: number[];
  showDatePicker: boolean;
  showTimePicker: boolean;
  showEndDatePicker: boolean;
  timeDate: Date;
  setSelectedDays: (days: any) => void;
  setRepeatType: (type: 'single_week' | 'weekly') => void;
  setIsRecurrent: (recurrent: boolean) => void;
  setSeats: (seats: number) => void;
  setShowDatePicker: (show: boolean) => void;
  setShowTimePicker: (show: boolean) => void;
  setShowEndDatePicker: (show: boolean) => void;
  onChangeDate: (event: any, date?: Date) => void;
  onChangeEndDate: (event: any, date?: Date) => void;
  onChangeTime: (event: any, date?: Date) => void;
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function DateTimeStep({
  selectedDateObj,
  time,
  seats,
  isRecurrent,
  repeatType,
  endDateObj,
  selectedDays,
  showDatePicker,
  showTimePicker,
  showEndDatePicker,
  timeDate,
  setSelectedDays,
  setRepeatType,
  setIsRecurrent,
  setSeats,
  setShowDatePicker,
  setShowTimePicker,
  setShowEndDatePicker,
  onChangeDate,
  onChangeEndDate,
  onChangeTime
}: DateTimeStepProps) {
  const getEstimatedRides = () => {
    if (!isRecurrent || selectedDays.length === 0) return 0;
    if (repeatType === 'single_week') return selectedDays.length;
    if (endDateObj < selectedDateObj) return 0;
    let count = 0;
    const current = new Date(selectedDateObj);
    while (current <= endDateObj) {
      const jsDay = current.getDay();
      const myDay = jsDay === 0 ? 6 : jsDay - 1;
      if (selectedDays.includes(myDay)) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  return (
    <View>
      <Text style={styles.stepTitle}>Quand partez-vous ?</Text>
      <Text style={styles.stepSubtitle}>Définissez la date, l'heure et le nombre de places</Text>

      {/* Date & Time */}
      {!isRecurrent && (
        <View style={styles.row}>
          <TouchableOpacity style={styles.halfCard} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.halfCardLabel}>Date de départ</Text>
            <Text style={styles.halfCardValue}>
              {selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.halfCard} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
            <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.halfCardLabel}>Heure de départ</Text>
            <Text style={styles.halfCardValue}>{time}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isRecurrent && (
        <TouchableOpacity style={[styles.halfCard, { marginBottom: 16 }]} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
          <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.halfCardLabel}>Heure de départ</Text>
          <Text style={styles.halfCardValue}>{time}</Text>
        </TouchableOpacity>
      )}

      {/* Seats */}
      <View style={styles.seatCard}>
        <Ionicons name="people-outline" size={22} color={theme.colors.primary} />
        <Text style={styles.seatLabel}>Nombre de places</Text>
        <View style={styles.seatStepper}>
          <TouchableOpacity onPress={() => setSeats(Math.max(1, seats - 1))} style={styles.seatBtn}>
            <Ionicons name="remove" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.seatValue}>{seats}</Text>
          <TouchableOpacity onPress={() => setSeats(Math.min(8, seats + 1))} style={styles.seatBtn}>
            <Ionicons name="add" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Recurrent toggle */}
      <View style={styles.recurrentCard}>
        <View style={styles.recurrentHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="repeat-outline" size={20} color={isRecurrent ? theme.colors.primary : theme.colors.textLight} />
            <Text style={styles.recurrentHeaderText}>Trajet récurrent</Text>
          </View>
          <Switch
            value={isRecurrent}
            onValueChange={setIsRecurrent}
            trackColor={{ false: '#E5E7EB', true: theme.colors.primaryLight }}
            thumbColor={isRecurrent ? theme.colors.primary : '#FFFFFF'}
          />
        </View>

        {isRecurrent && (
          <View style={styles.recurrentBody}>
            <View style={styles.repeatTypeContainer}>
              {(['single_week', 'weekly'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.repeatBox, repeatType === type && styles.repeatBoxActive]}
                  onPress={() => setRepeatType(type)}
                >
                  <Ionicons
                    name={type === 'single_week' ? 'calendar-outline' : 'calendar-number-outline'}
                    size={16} color={repeatType === type ? theme.colors.primary : theme.colors.textLight}
                  />
                  <Text style={[styles.repeatBoxText, repeatType === type && styles.repeatBoxTextActive]}>
                    {type === 'single_week' ? 'Cette semaine' : 'Chaque semaine'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Start date */}
            <Text style={styles.recurrentLabel}>Date de début</Text>
            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.dateSelectorText}>
                {selectedDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </TouchableOpacity>

            {/* End date (weekly only) */}
            {repeatType === 'weekly' && (
              <>
                <Text style={[styles.recurrentLabel, { marginTop: 12 }]}>Date de fin</Text>
                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowEndDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.dateSelectorText}>
                    {endDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Days */}
            <Text style={[styles.recurrentLabel, { marginTop: 12 }]}>Jours de la semaine</Text>
            <View style={styles.daysContainer}>
              {DAYS_FR.map((day, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.dayBox, selectedDays.includes(idx) && styles.dayBoxActive]}
                  onPress={() => setSelectedDays((prev: number[]) => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])}
                >
                  <Text style={[styles.dayBoxText, selectedDays.includes(idx) && styles.dayBoxTextActive]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedDays.length > 0 && (
              <View style={styles.estimatedRidesBox}>
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                <Text style={styles.estimatedRidesText}>{getEstimatedRides()} trajet(s) seront générés</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDateObj} mode="date" display="default" minimumDate={new Date()}
          onChange={onChangeDate}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={endDateObj} mode="date" display="default" minimumDate={selectedDateObj}
          onChange={onChangeEndDate}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={timeDate} mode="time" is24Hour={true} display="default"
          onChange={onChangeTime}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 20, marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: theme.colors.textLight, marginBottom: 20, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  halfCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  halfCardLabel: { fontSize: 12, color: theme.colors.textLight, fontWeight: '600' },
  halfCardValue: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  seatCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 16, gap: 12 },
  seatLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text },
  seatStepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  seatBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  seatValue: { fontSize: 22, fontWeight: '800', color: theme.colors.text, minWidth: 30, textAlign: 'center' },
  recurrentCard: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  recurrentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FAFBFC' },
  recurrentHeaderText: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  recurrentBody: { padding: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  recurrentLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 4 },
  dateSelectorText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  repeatTypeContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  repeatBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  repeatBoxActive: { backgroundColor: '#EFF6FF', borderColor: theme.colors.primary },
  repeatBoxText: { fontSize: 13, fontWeight: '600', color: theme.colors.textLight },
  repeatBoxTextActive: { color: theme.colors.primary },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  dayBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  dayBoxActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayBoxText: { fontSize: 11, fontWeight: '700', color: theme.colors.textLight },
  dayBoxTextActive: { color: '#FFFFFF' },
  estimatedRidesBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10 },
  estimatedRidesText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary }
});
