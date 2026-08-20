import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../../../../src/styles/theme';

type RepeatType = 'single_week' | 'weekly';

export interface DaySchedule {
  day: number; // 0 = lundi ... 6 = dimanche
  time: string; // HH:mm
}

interface DateTimeStepProps {
  selectedDateObj: Date;
  time: string;
  seats: number;

  isRecurrent: boolean;
  repeatType: RepeatType;
  endDateObj: Date;

  selectedDays: number[];
  daySchedules: DaySchedule[];

  showDatePicker: boolean;
  showTimePicker: boolean;
  showEndDatePicker: boolean;

  timeDate: Date;

  setSelectedDays: (
    days: number[] | ((prev: number[]) => number[])
  ) => void;

  setDaySchedules: (
    schedules:
      | DaySchedule[]
      | ((prev: DaySchedule[]) => DaySchedule[])
  ) => void;

  setRepeatType: (type: RepeatType) => void;
  setIsRecurrent: (recurrent: boolean) => void;
  setSeats: (seats: number) => void;

  setShowDatePicker: (show: boolean) => void;
  setShowTimePicker: (show: boolean) => void;
  setShowEndDatePicker: (show: boolean) => void;

  onChangeDate: (event: any, date?: Date) => void;
  onChangeEndDate: (event: any, date?: Date) => void;
  onChangeTime: (event: any, date?: Date) => void;
}

const DAYS_FR = [
  'Lun',
  'Mar',
  'Mer',
  'Jeu',
  'Ven',
  'Sam',
  'Dim',
];

const DAYS_FULL_FR = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

const DEFAULT_TIME = '08:00';

const formatDate = (date: Date, long = false) => {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric',
  });
};

const formatDuration = (totalMin: number): string => {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;

  return `${h}h${m.toString().padStart(2, '0')}`;
};

const timeToDate = (time: string): Date => {
  const [hours, minutes] = time.split(':').map(Number);

  const date = new Date();
  date.setHours(hours || 8);
  date.setMinutes(minutes || 0);
  date.setSeconds(0);
  date.setMilliseconds(0);

  return date;
};

const dateToTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${hours}:${minutes}`;
};

const jsDayToAppDay = (jsDay: number): number => {
  // JS : dimanche = 0
  // Notre système : lundi = 0
  return jsDay === 0 ? 6 : jsDay - 1;
};

const getDateWithoutTime = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export function DateTimeStep({
  selectedDateObj,
  time,
  seats,
  isRecurrent,
  repeatType,
  endDateObj,
  selectedDays,
  daySchedules,
  showDatePicker,
  showTimePicker,
  showEndDatePicker,
  timeDate,

  setSelectedDays,
  setDaySchedules,
  setRepeatType,
  setIsRecurrent,
  setSeats,

  setShowDatePicker,
  setShowTimePicker,
  setShowEndDatePicker,

  onChangeDate,
  onChangeEndDate,
  onChangeTime,
}: DateTimeStepProps) {
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [showDayTimePicker, setShowDayTimePicker] = useState(false);

  /**
   * Sélection / désélection d'un jour
   */
  const toggleDay = (day: number) => {
    const alreadySelected = selectedDays.includes(day);

    if (alreadySelected) {
      // Retirer le jour
      setSelectedDays(prev => prev.filter(d => d !== day));

      // Retirer également son horaire
      setDaySchedules(prev =>
        prev.filter(schedule => schedule.day !== day)
      );

      return;
    }

    // Ajouter le jour
    setSelectedDays(prev =>
      [...prev, day].sort((a, b) => a - b)
    );

    // Ajouter une heure par défaut
    setDaySchedules(prev => {
      if (prev.some(schedule => schedule.day === day)) {
        return prev;
      }

      return [
        ...prev,
        {
          day,
          time: time || DEFAULT_TIME,
        },
      ].sort((a, b) => a.day - b.day);
    });
  };

  /**
   * Récupérer l'heure d'un jour
   */
  const getDayTime = (day: number) => {
    return (
      daySchedules.find(schedule => schedule.day === day)?.time ||
      time ||
      DEFAULT_TIME
    );
  };

  /**
   * Modifier l'heure d'un jour précis
   */
  const updateDayTime = (day: number, newTime: string) => {
    setDaySchedules(prev => {
      const exists = prev.some(schedule => schedule.day === day);

      if (!exists) {
        return [
          ...prev,
          {
            day,
            time: newTime,
          },
        ].sort((a, b) => a.day - b.day);
      }

      return prev.map(schedule =>
        schedule.day === day
          ? {
              ...schedule,
              time: newTime,
            }
          : schedule
      );
    });
  };

  /**
   * Ouvrir le sélecteur d'heure pour un jour
   */
  const openDayTimePicker = (day: number) => {
    setEditingDay(day);
    setShowDayTimePicker(true);
  };

  /**
   * Changement de l'heure d'un jour
   */
  const handleDayTimeChange = (
    event: any,
    date?: Date
  ) => {
    if (Platform.OS === 'android') {
      setShowDayTimePicker(false);
    }

    if (event?.type === 'dismissed') {
      setEditingDay(null);
      return;
    }

    if (date && editingDay !== null) {
      updateDayTime(
        editingDay,
        dateToTime(date)
      );
    }

    if (Platform.OS !== 'android') {
      setShowDayTimePicker(false);
    }

    setEditingDay(null);
  };

  /**
   * Date actuellement utilisée par le picker
   */
  const editingDayDate = useMemo(() => {
    if (editingDay === null) {
      return timeToDate(time || DEFAULT_TIME);
    }

    return timeToDate(getDayTime(editingDay));
  }, [editingDay, daySchedules, time]);

  /**
   * Calcul du nombre de trajets récurrents
   */
  const getEstimatedRides = () => {
    if (!isRecurrent || selectedDays.length === 0) {
      return 0;
    }

    const start = getDateWithoutTime(selectedDateObj);

    if (repeatType === 'single_week') {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      let count = 0;

      const current = new Date(start);

      while (current <= end) {
        const appDay = jsDayToAppDay(current.getDay());

        if (selectedDays.includes(appDay)) {
          count++;
        }

        current.setDate(current.getDate() + 1);
      }

      return count;
    }

    const end = getDateWithoutTime(endDateObj);

    if (end < start) {
      return 0;
    }

    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const appDay = jsDayToAppDay(current.getDay());

      if (selectedDays.includes(appDay)) {
        count++;
      }

      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  const estimatedRides = getEstimatedRides();

  /**
   * Vérification de la programmation
   */
  const hasInvalidSchedule =
    isRecurrent &&
    selectedDays.some(
      day => !daySchedules.some(
        schedule =>
          schedule.day === day &&
          !!schedule.time
      )
    );

  return (
    <View>
      {/* =========================================
          TITRE
      ========================================== */}
      <Text style={styles.stepTitle}>
        Quand partez-vous ?
      </Text>

      <Text style={styles.stepSubtitle}>
        Définissez la date, l'heure et le nombre de places
      </Text>

      {/* =========================================
          TRAJET SIMPLE
      ========================================== */}

      {!isRecurrent && (
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.halfCard}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.75}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={theme.colors.primary}
              />
            </View>

            <Text style={styles.halfCardLabel}>
              Date de départ
            </Text>

            <Text style={styles.halfCardValue}>
              {formatDate(selectedDateObj)}
            </Text>

            <Ionicons
              name="chevron-forward"
              size={16}
              color="#94A3B8"
              style={styles.cardChevron}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.halfCard}
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.75}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name="time-outline"
                size={20}
                color={theme.colors.primary}
              />
            </View>

            <Text style={styles.halfCardLabel}>
              Heure de départ
            </Text>

            <Text style={styles.halfCardValue}>
              {time}
            </Text>

            <Ionicons
              name="chevron-forward"
              size={16}
              color="#94A3B8"
              style={styles.cardChevron}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* =========================================
          HEURE POUR TRAJET RÉCURRENT
      ========================================== */}

      {isRecurrent && (
        <View style={styles.defaultTimeCard}>
          <View style={styles.defaultTimeIcon}>
            <Ionicons
              name="time-outline"
              size={22}
              color={theme.colors.primary}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.defaultTimeLabel}>
              Heure par défaut
            </Text>

            <Text style={styles.defaultTimeDescription}>
              Utilisée lorsque vous ajoutez un nouveau jour
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowTimePicker(true)}
            style={styles.defaultTimeButton}
            activeOpacity={0.75}
          >
            <Text style={styles.defaultTimeValue}>
              {time}
            </Text>

            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* =========================================
          PLACES
      ========================================== */}

      <View style={styles.seatCard}>
        <View style={styles.seatIcon}>
          <Ionicons
            name="people-outline"
            size={22}
            color={theme.colors.primary}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.seatLabel}>
            Nombre de places
          </Text>

          <Text style={styles.seatDescription}>
            Places disponibles pour les passagers
          </Text>
        </View>

        <View style={styles.seatStepper}>
          <TouchableOpacity
            onPress={() =>
              setSeats(Math.max(1, seats - 1))
            }
            style={styles.seatBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name="remove"
              size={18}
              color={theme.colors.primary}
            />
          </TouchableOpacity>

          <Text style={styles.seatValue}>
            {seats}
          </Text>

          <TouchableOpacity
            onPress={() =>
              setSeats(Math.min(8, seats + 1))
            }
            style={styles.seatBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name="add"
              size={18}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* =========================================
          RÉCURRENCE
      ========================================== */}

      <View style={styles.recurrentCard}>
        <View style={styles.recurrentHeader}>
          <View style={styles.recurrentTitleContainer}>
            <View
              style={[
                styles.recurrentIcon,
                isRecurrent && styles.recurrentIconActive,
              ]}
            >
              <Ionicons
                name="repeat-outline"
                size={20}
                color={
                  isRecurrent
                    ? theme.colors.primary
                    : theme.colors.textLight
                }
              />
            </View>

            <View>
              <Text style={styles.recurrentHeaderText}>
                Trajets récurrents
              </Text>

              <Text style={styles.recurrentDescription}>
                Programmez plusieurs départs
              </Text>
            </View>
          </View>

          <Switch
            value={isRecurrent}
            onValueChange={value => {
              setIsRecurrent(value);

              if (!value) {
                setSelectedDays([]);
                setDaySchedules([]);
              }
            }}
            trackColor={{
              false: '#E2E8F0',
              true: theme.colors.primaryLight,
            }}
            thumbColor={
              isRecurrent
                ? theme.colors.primary
                : '#FFFFFF'
            }
          />
        </View>

        {isRecurrent && (
          <View style={styles.recurrentBody}>
            {/* =====================================
                TYPE DE RÉCURRENCE
            ====================================== */}

            <Text style={styles.sectionLabel}>
              Fréquence
            </Text>

            <View style={styles.repeatTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.repeatBox,
                  repeatType === 'single_week' &&
                    styles.repeatBoxActive,
                ]}
                onPress={() =>
                  setRepeatType('single_week')
                }
                activeOpacity={0.75}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={
                    repeatType === 'single_week'
                      ? theme.colors.primary
                      : theme.colors.textLight
                  }
                />

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.repeatBoxText,
                      repeatType === 'single_week' &&
                        styles.repeatBoxTextActive,
                    ]}
                  >
                    Cette semaine
                  </Text>

                  <Text style={styles.repeatBoxDescription}>
                    Jusqu'à 7 jours
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.repeatBox,
                  repeatType === 'weekly' &&
                    styles.repeatBoxActive,
                ]}
                onPress={() =>
                  setRepeatType('weekly')
                }
                activeOpacity={0.75}
              >
                <Ionicons
                  name="calendar-number-outline"
                  size={18}
                  color={
                    repeatType === 'weekly'
                      ? theme.colors.primary
                      : theme.colors.textLight
                  }
                />

                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.repeatBoxText,
                      repeatType === 'weekly' &&
                        styles.repeatBoxTextActive,
                    ]}
                  >
                    Chaque semaine
                  </Text>

                  <Text style={styles.repeatBoxDescription}>
                    Jusqu'à la date choisie
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* =====================================
                DATE DE DÉBUT
            ====================================== */}

            <Text style={styles.sectionLabel}>
              Date de début
            </Text>

            <TouchableOpacity
              style={styles.dateSelector}
              onPress={() =>
                setShowDatePicker(true)
              }
              activeOpacity={0.75}
            >
              <View style={styles.dateIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={theme.colors.primary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.dateSelectorLabel}>
                  Premier départ
                </Text>

                <Text style={styles.dateSelectorText}>
                  {formatDate(
                    selectedDateObj,
                    true
                  )}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color="#94A3B8"
              />
            </TouchableOpacity>

            {/* =====================================
                DATE DE FIN
            ====================================== */}

            {repeatType === 'weekly' && (
              <>
                <Text
                  style={[
                    styles.sectionLabel,
                    { marginTop: 16 },
                  ]}
                >
                  Date de fin
                </Text>

                <TouchableOpacity
                  style={styles.dateSelector}
                  onPress={() =>
                    setShowEndDatePicker(true)
                  }
                  activeOpacity={0.75}
                >
                  <View style={styles.dateIcon}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateSelectorLabel}>
                      Dernier départ possible
                    </Text>

                    <Text style={styles.dateSelectorText}>
                      {formatDate(
                        endDateObj,
                        true
                      )}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </>
            )}

            {/* =====================================
                JOURS
            ====================================== */}

            <View style={styles.daysHeader}>
              <View>
                <Text style={styles.sectionLabel}>
                  Jours de départ
                </Text>

                <Text style={styles.daysHint}>
                  Sélectionnez les jours souhaités
                </Text>
              </View>

              {selectedDays.length > 0 && (
                <View style={styles.selectedCountBadge}>
                  <Text style={styles.selectedCountText}>
                    {selectedDays.length}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.daysContainer}>
              {DAYS_FR.map((day, idx) => {
                const active =
                  selectedDays.includes(idx);

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayBox,
                      active &&
                        styles.dayBoxActive,
                    ]}
                    onPress={() =>
                      toggleDay(idx)
                    }
                    activeOpacity={0.75}
                  >
                    {active && (
                      <Ionicons
                        name="checkmark"
                        size={11}
                        color="#FFFFFF"
                        style={styles.dayCheck}
                      />
                    )}

                    <Text
                      style={[
                        styles.dayBoxText,
                        active &&
                          styles.dayBoxTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* =====================================
                HORAIRES PAR JOUR
            ====================================== */}

            {selectedDays.length > 0 && (
              <View style={styles.scheduleSection}>
                <View style={styles.scheduleHeader}>
                  <View>
                    <Text style={styles.sectionLabel}>
                      Horaires de départ
                    </Text>

                    <Text style={styles.daysHint}>
                      Chaque jour peut avoir une heure différente
                    </Text>
                  </View>

                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>

                {selectedDays.map(day => (
                  <TouchableOpacity
                    key={day}
                    style={styles.scheduleItem}
                    onPress={() =>
                      openDayTimePicker(day)
                    }
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.scheduleDayIcon,
                        {
                          backgroundColor:
                            `${theme.colors.primary}12`,
                        },
                      ]}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={theme.colors.primary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.scheduleDay}>
                        {DAYS_FULL_FR[day]}
                      </Text>

                      <Text style={styles.scheduleSubtitle}>
                        Heure de départ
                      </Text>
                    </View>

                    <View style={styles.scheduleTime}>
                      <Text style={styles.scheduleTimeText}>
                        {getDayTime(day)}
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color={
                          theme.colors.primary
                        }
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* =====================================
                MESSAGE SI AUCUN JOUR
            ====================================== */}

            {selectedDays.length === 0 && (
              <View style={styles.emptyDays}>
                <View style={styles.emptyDaysIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={24}
                    color="#94A3B8"
                  />
                </View>

                <Text style={styles.emptyDaysTitle}>
                  Aucun jour sélectionné
                </Text>

                <Text style={styles.emptyDaysText}>
                  Choisissez au moins un jour pour
                  programmer vos trajets.
                </Text>
              </View>
            )}

            {/* =====================================
                RÉSUMÉ
            ====================================== */}

            {selectedDays.length > 0 && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <View style={styles.summaryIcon}>
                    <Ionicons
                      name="checkmark-circle"
                      size={21}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryTitle}>
                      Programmation prête
                    </Text>

                    <Text style={styles.summarySubtitle}>
                      {estimatedRides}{' '}
                      trajet
                      {estimatedRides > 1
                        ? 's'
                        : ''}{' '}
                      seront générés
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryDivider} />

                {selectedDays.map(day => (
                  <View
                    key={day}
                    style={styles.summaryRow}
                  >
                    <View
                      style={[
                        styles.summaryDot,
                        {
                          backgroundColor:
                            theme.colors.primary,
                        },
                      ]}
                    />

                    <Text
                      style={styles.summaryDay}
                    >
                      {DAYS_FULL_FR[day]}
                    </Text>

                    <Text
                      style={styles.summaryTime}
                    >
                      {getDayTime(day)}
                    </Text>
                  </View>
                ))}

                {repeatType === 'weekly' && (
                  <Text style={styles.summaryFooter}>
                    Du {formatDate(selectedDateObj)}
                    {' '}au{' '}
                    {formatDate(endDateObj)}
                  </Text>
                )}
              </View>
            )}

            {hasInvalidSchedule && (
              <View style={styles.warningBox}>
                <Ionicons
                  name="warning-outline"
                  size={18}
                  color="#D97706"
                />

                <Text style={styles.warningText}>
                  Définissez une heure pour chaque
                  jour sélectionné.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* =========================================
          DATE PICKER
      ========================================== */}

      {showDatePicker && (
        <DateTimePicker
          value={selectedDateObj}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={onChangeDate}
        />
      )}

      {/* =========================================
          DATE FIN PICKER
      ========================================== */}

      {showEndDatePicker && (
        <DateTimePicker
          value={endDateObj}
          mode="date"
          display="default"
          minimumDate={selectedDateObj}
          onChange={onChangeEndDate}
        />
      )}

      {/* =========================================
          HEURE SIMPLE / HEURE PAR DÉFAUT
      ========================================== */}

      {showTimePicker && (
        <DateTimePicker
          value={timeDate}
          mode="time"
          is24Hour
          display="default"
          onChange={onChangeTime}
        />
      )}

      {/* =========================================
          HEURE D'UN JOUR RÉCURRENT
      ========================================== */}

      {showDayTimePicker && editingDay !== null && (
        <DateTimePicker
          value={editingDayDate}
          mode="time"
          is24Hour
          display="default"
          onChange={handleDayTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 20,
    marginBottom: 7,
    letterSpacing: -0.4,
  },

  stepSubtitle: {
    fontSize: 14,
    color: theme.colors.textLight,
    marginBottom: 20,
    lineHeight: 21,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },

  halfCard: {
    flex: 1,
    minHeight: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },

  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.primary}10`,
    marginBottom: 10,
  },

  cardChevron: {
    position: 'absolute',
    right: 12,
    bottom: 14,
  },

  halfCardLabel: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '600',
    marginBottom: 4,
  },

  halfCardValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    paddingRight: 20,
  },

  defaultTimeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  defaultTimeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.primary}10`,
    marginRight: 12,
  },

  defaultTimeLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },

  defaultTimeDescription: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 3,
  },

  defaultTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: `${theme.colors.primary}08`,
    borderRadius: 10,
  },

  defaultTimeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  seatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  seatIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.primary}10`,
    marginRight: 12,
  },

  seatLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },

  seatDescription: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 3,
  },

  seatStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  seatBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: `${theme.colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
  },

  seatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    minWidth: 25,
    textAlign: 'center',
  },

  recurrentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },

  recurrentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FCFDFE',
  },

  recurrentTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  recurrentIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    marginRight: 12,
  },

  recurrentIconActive: {
    backgroundColor: `${theme.colors.primary}12`,
  },

  recurrentHeaderText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },

  recurrentDescription: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 3,
  },

  recurrentBody: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },

  repeatTypeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },

  repeatBox: {
    flex: 1,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },

  repeatBoxActive: {
    backgroundColor: `${theme.colors.primary}08`,
    borderColor: theme.colors.primary,
  },

  repeatBoxText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textLight,
  },

  repeatBoxTextActive: {
    color: theme.colors.primary,
  },

  repeatBoxDescription: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },

  dateSelector: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  dateIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: `${theme.colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  dateSelectorLabel: {
    fontSize: 10,
    color: theme.colors.textLight,
    fontWeight: '600',
    marginBottom: 2,
  },

  dateSelectorText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },

  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 18,
  },

  daysHint: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: -4,
    marginBottom: 9,
  },

  selectedCountBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.primary}12`,
    marginBottom: 9,
  },

  selectedCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  dayBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },

  dayBoxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },

  dayBoxText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textLight,
  },

  dayBoxTextActive: {
    color: '#FFFFFF',
  },

  dayCheck: {
    position: 'absolute',
    top: 3,
    right: 3,
  },

  scheduleSection: {
    marginTop: 18,
  },

  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  scheduleItem: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    marginBottom: 9,
  },

  scheduleDayIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  scheduleDay: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },

  scheduleSubtitle: {
    fontSize: 10,
    color: theme.colors.textLight,
    marginTop: 2,
  },

  scheduleTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  scheduleTimeText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  emptyDays: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    padding: 20,
    marginTop: 16,
  },

  emptyDaysIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  emptyDaysTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },

  emptyDaysText: {
    fontSize: 11,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 17,
  },

  summaryCard: {
    backgroundColor: `${theme.colors.primary}07`,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}20`,
    padding: 14,
    marginTop: 14,
  },

  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryIcon: {
    marginRight: 10,
  },

  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },

  summarySubtitle: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: `${theme.colors.primary}15`,
    marginVertical: 10,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },

  summaryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 9,
  },

  summaryDay: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },

  summaryTime: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  summaryFooter: {
    fontSize: 10,
    color: theme.colors.textLight,
    marginTop: 8,
    textAlign: 'center',
  },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 11,
    marginTop: 10,
  },

  warningText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
});
