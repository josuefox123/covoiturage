import React from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Conversation {
  id: string;
  userName: string;
  userAvatar: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  rideRoute: string;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    userName: 'Chérif G.',
    userAvatar: 'CG',
    lastMessage: 'Super, on se voit à l\'Étoile Rouge à 07h30 précises. Bonne soirée !',
    time: '10:24',
    unreadCount: 2,
    rideRoute: 'Cotonou ➔ Parakou',
  },
  {
    id: '2',
    userName: 'Amina T.',
    userAvatar: 'AT',
    lastMessage: 'Pas de souci, j\'ai bien reçu ton numéro.',
    time: 'Hier',
    unreadCount: 0,
    rideRoute: 'Abomey-Calavi ➔ Porto-Novo',
  },
  {
    id: '3',
    userName: 'Dona S.',
    userAvatar: 'DS',
    lastMessage: 'Le coffre est assez grand pour deux grosses valises ?',
    time: 'Lundi',
    unreadCount: 0,
    rideRoute: 'Ouidah ➔ Cotonou',
  }
];

export default function MessagesScreen() {
  const router = useRouter();

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => router.push(`/chat/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.userAvatar}</Text>
        </View>
        {item.unreadCount > 0 && <View style={styles.activeIndicator} />}
      </View>

      <View style={styles.chatDetails}>
        <View style={styles.chatHeader}>
          <Text style={styles.userName}>{item.userName}</Text>
          <Text style={styles.timeText}>{item.time}</Text>
        </View>
        
        <Text style={styles.routeBadge}>{item.rideRoute}</Text>
        
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>

      <View style={styles.rightActions}>
        {item.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Discussions 💬</Text>
        <Text style={styles.subtitle}>Échangez avec vos conducteurs et passagers.</Text>
      </View>

      {/* Conversations List */}
      <FlatList
        data={MOCK_CONVERSATIONS}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Aucune discussion</Text>
            <Text style={styles.emptySubtitle}>Vos conversations apparaîtront ici lorsque vous réserverez ou publierez un trajet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textLight,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: theme.colors.secondaryDark,
    fontWeight: '700',
    fontSize: 16,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatDetails: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  userName: {
    ...theme.typography.bodyLarge,
    fontWeight: '600',
    color: theme.colors.text,
  },
  timeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
  },
  routeBadge: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
    backgroundColor: theme.colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  lastMessage: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textLight,
  },
  rightActions: {
    marginLeft: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: theme.colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  separator: {
    height: theme.spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptySubtitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
