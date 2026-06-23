/**
 * ==============================================================
 * Fichier :
 * AppBottomSheet.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { theme } from '../styles/theme';

interface AppBottomSheetProps {
  /**
   * Determine if the bottom sheet is visible. Used to simulate standard Modal behavior.
   */
  visible: boolean;
  /**
   * Callback fired when the bottom sheet requests to close (e.g., via swipe down or backdrop press)
   */
  onClose: () => void;
  /**
   * The content of the bottom sheet
   */
  children: React.ReactNode;
  /**
   * Snap points for the bottom sheet. Defaults to ['20%', '75%', '95%']
   */
  snapPoints?: (string | number)[];
  /**
   * Initial snap index when opened. Defaults to 1 (75% usually)
   */
  initialIndex?: number;
  /**
   * Use ScrollView for content to handle long lists or keyboard. Defaults to true.
   */
  useScrollView?: boolean;
}

export const AppBottomSheet: React.FC<AppBottomSheetProps> = ({
  visible,
  onClose,
  children,
  snapPoints = ['75%', '95%'],
  initialIndex = 0,
  useScrollView = true,
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Le BottomSheet reste TOUJOURS monté — on pilote l'ouverture/fermeture via l'index.
  // Cela évite le coûteux cycle mount/unmount (et les re-fetch) à chaque ouverture.
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.snapToIndex(initialIndex);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible, initialIndex]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={initialIndex}
      />
    ),
    [initialIndex]
  );

  // Mémoïser les snapPoints pour éviter un re-render du BottomSheet si le parent re-rend
  const stableSnapPoints = useMemo(() => snapPoints, []); // eslint-disable-line react-hooks/exhaustive-deps

  // We capture the initial visibility to set the static 'index' prop.
  // This prevents the prop from changing dynamically (which breaks the sheet),
  // while allowing conditionally rendered sheets to mount open.
  const isInitiallyVisible = useRef(visible).current;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={stableSnapPoints}
      index={isInitiallyVisible ? initialIndex : -1}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      {useScrollView ? (
        <BottomSheetScrollView contentContainerStyle={styles.contentContainer}>
          {children}
        </BottomSheetScrollView>
      ) : (
        <View style={[styles.contentContainer, { flex: 1, paddingHorizontal: 0, paddingTop: 0 }]}>
          {children}
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: theme.colors.background,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  handleIndicator: {
    backgroundColor: theme.colors.border,
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: 40, // Extra padding for SafeArea/Home indicator
  },
});
