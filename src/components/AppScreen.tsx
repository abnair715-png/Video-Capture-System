import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { appTheme } from '../config/theme';

type AppScreenProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function AppScreen({ title, description, children }: AppScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    color: appTheme.colors.text,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    color: appTheme.colors.mutedText,
    fontSize: 16,
    lineHeight: 24,
  },
  content: {
    marginTop: 24,
  },
});
