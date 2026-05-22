import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from "react-native";

export interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface SearchBarProps {
  onSelectResult: (result: SearchResult) => void;
}

export function SearchBar({ onSelectResult }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (text: string) => {
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=0`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "com.smart.babetta.app",
          "Accept-Language": "cs",
        },
      });
      const data: SearchResult[] = await res.json();
      setResults(data);
    } catch (e) {
      console.warn("Nominatim search error:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 500);
  };

  const handleSelect = (result: SearchResult) => {
    setQuery(result.display_name.split(",")[0]);
    setResults([]);
    setExpanded(false);
    Keyboard.dismiss();
    onSelectResult(result);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setExpanded(false);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChangeText}
          onFocus={() => setExpanded(true)}
          placeholder="Vyhledat cíl…"
          placeholderTextColor="#374151"
          returnKeyType="search"
          onSubmitEditing={() => search(query)}
          clearButtonMode="never"
        />
        {loading && <ActivityIndicator size="small" color="#00E5FF" style={{ marginRight: 8 }} />}
        {query.length > 0 && !loading && (
          <Pressable onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {expanded && results.length > 0 && (
        <View style={styles.resultsList}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id.toString()}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={({ pressed }) => [styles.resultItem, pressed && styles.resultItemPressed]}
              >
                <Text style={styles.resultText} numberOfLines={2}>
                  {item.display_name}
                </Text>
              </Pressable>
            )}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    zIndex: 100,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderColor: "#1C2A35",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  input: {
    flex: 1,
    color: "#ECEDEE",
    fontSize: 14,
    height: "100%",
  },
  clearButton: {
    padding: 6,
  },
  clearText: {
    color: "#6B7280",
    fontSize: 14,
  },
  resultsList: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderColor: "#1C2A35",
    borderRadius: 10,
    overflow: "hidden",
    zIndex: 200,
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1C2A35",
  },
  resultItemPressed: {
    backgroundColor: "rgba(0,229,255,0.06)",
  },
  resultText: {
    color: "#ECEDEE",
    fontSize: 13,
    lineHeight: 18,
  },
});
