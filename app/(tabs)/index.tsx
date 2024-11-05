import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import CryptoJS from 'crypto-js';
import { Ionicons } from '@expo/vector-icons';
interface PasswordItem {
  id: string;
  name: string;
  password: string;
}
const SECRET_KEY = 'your_secret_key';
const PasswordManagerScreen: React.FC = () => {
  const [passwords, setPasswords] = useState<PasswordItem[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [currentIdToShow, setCurrentIdToShow] = useState<string | null>(null);
  const [isAddPasswordModalVisible, setIsAddPasswordModalVisible] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    message: '',
    color: '#ccc'
  });
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedPasswordId, setSelectedPasswordId] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    loadPasswords();
  }, []);

  useEffect(() => {
    checkPasswordStrength(newPassword);
  }, [newPassword]);

  const checkPasswordStrength = (password: string) => {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    score = Object.values(checks).filter(Boolean).length;

    const strengthMap = {
      0: { message: 'Very Weak', color: '#ff4444' },
      1: { message: 'Weak', color: '#ffbb33' },
      2: { message: 'Fair', color: '#ffbb33' },
      3: { message: 'Good', color: '#00C851' },
      4: { message: 'Strong', color: '#007E33' },
      5: { message: 'Very Strong', color: '#007E33' }
    };

    setPasswordStrength({
      score,
      message: strengthMap[score as keyof typeof strengthMap].message,
      color: strengthMap[score as keyof typeof strengthMap].color
    });
  };
  const generatePassword = () => {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let generatedPassword = "";
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      generatedPassword += charset[randomIndex];
    }
    
    setNewPassword(generatedPassword);
  };

  const encryptPassword = (password: string): string => {
    try {
      // Create a consistent salt for the encryption
      const salt = CryptoJS.enc.Hex.parse(SECRET_KEY.slice(0, 32));
      
      // Create key and IV
      const key = CryptoJS.PBKDF2(SECRET_KEY, salt, {
        keySize: 256/32,
        iterations: 1000
      });
      
      // Convert the password to a CryptoJS WordArray
      const passwordData = CryptoJS.enc.Utf8.parse(password);
      
      // Encrypt the password
      const encrypted = CryptoJS.AES.encrypt(passwordData, key, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
        iv: salt
      });
      
      // Return the complete encrypted string
      return encrypted.toString();
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  };
  
  // Modified decryption function that works in React Native
  const decryptPassword = (encryptedPassword: string): string => {
    try {
      // Recreate the same salt
      const salt = CryptoJS.enc.Hex.parse(SECRET_KEY.slice(0, 32));
      
      // Recreate the same key
      const key = CryptoJS.PBKDF2(SECRET_KEY, salt, {
        keySize: 256/32,
        iterations: 1000
      });
      
      // Decrypt the password
      const decrypted = CryptoJS.AES.decrypt(encryptedPassword, key, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
        iv: salt
      });
      
      // Convert the decrypted data back to UTF8 string
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  };

  const loadPasswords = async () => {
    try {
      const storedPasswords = await AsyncStorage.getItem('passwords');
      if (storedPasswords) {
        setPasswords(JSON.parse(storedPasswords));
      }
    } catch (error) {
      console.error('Failed to load passwords:', error);
    }
  };

  const savePasswords = async (updatedPasswords: PasswordItem[]) => {
    try {
      await AsyncStorage.setItem('passwords', JSON.stringify(updatedPasswords));
      setPasswords(updatedPasswords);
    } catch (error) {
      console.error('Failed to save passwords:', error);
    }
  };

  const addPassword = async () => {
    if (name && newPassword) {
      try {
        console.log('Encrypting password...');
        const encryptedPassword = encryptPassword(newPassword);
        console.log('Password encrypted successfully');
        
        const newEntry: PasswordItem = {
          id: Date.now().toString(),
          name,
          password: encryptedPassword,
        };
        
        const updatedPasswords = [...passwords, newEntry];
        await savePasswords(updatedPasswords);
        
        setName('');
        setNewPassword('');
        setIsAddPasswordModalVisible(false);
      } catch (error) {
        console.error('Error in addPassword:', error);
        Alert.alert('Error', 'Failed to save password. Please try again.');
      }
    } else {
      Alert.alert('Please enter both a name and a password.');
    }
  };


  const handleEdit = async (id: string) => {
    try {
      const hasBiometricHardware = await LocalAuthentication.hasHardwareAsync();
      const isBiometricEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasBiometricHardware && isBiometricEnrolled) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to edit password',
          disableDeviceFallback: false,
        });

        if (authResult.success) {
          const existingPassword = passwords.find(item => item.id === id);
          if (existingPassword) {
            try {
              const decryptedPassword = decryptPassword(existingPassword.password);
              if (decryptedPassword) {
                setName(existingPassword.name);
                setNewPassword(decryptedPassword);
                setSelectedPasswordId(id);
                setIsEditModalVisible(true);
              } else {
                Alert.alert('Error', 'Failed to decrypt password');
              }
            } catch (decryptError) {
              console.error('Decryption error:', decryptError);
              Alert.alert('Error', 'Failed to decrypt password. The stored password might be corrupted.');
            }
          }
        } else {
          Alert.alert('Authentication failed', 'Could not authenticate using biometrics.');
        }
      } else {
        setCurrentIdToShow(id);
        setIsPinModalVisible(true);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      Alert.alert('Error', 'An error occurred while authenticating.');
    }
  };


  const updatePassword = () => {
    if (name && newPassword && selectedPasswordId) {
      try {
        const encryptedPassword = encryptPassword(newPassword);
        const updatedPasswords = passwords.map(item =>
          item.id === selectedPasswordId 
            ? { ...item, name, password: encryptedPassword } 
            : item
        );
        savePasswords(updatedPasswords);
        setName('');
        setNewPassword('');
        setSelectedPasswordId(null);
        setIsEditModalVisible(false);
      } catch (error) {
        console.error('Encryption error:', error);
        Alert.alert('Error', 'Failed to encrypt password.');
      }
    } else {
      Alert.alert('Please enter both a name and a password.');
    }
  };

  const deletePassword = (id: string) => {
    Alert.alert('Confirm Deletion', 'Are you sure you want to delete this password?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const updatedPasswords = passwords.filter(item => item.id !== id);
          savePasswords(updatedPasswords);
        },
      },
    ]);
  };

  const togglePasswordVisibility = async (id: string) => {
    try {
      const hasBiometricHardware = await LocalAuthentication.hasHardwareAsync();
      const isBiometricEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasBiometricHardware && isBiometricEnrolled) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to view password',
          disableDeviceFallback: false,
        });

        if (authResult.success) {
          setVisiblePasswords(prevVisible => {
            const newVisible = new Set(prevVisible);
            if (newVisible.has(id)) {
              newVisible.delete(id);
            } else {
              // Test decryption before showing
              const passwordItem = passwords.find(item => item.id === id);
              if (passwordItem) {
                try {
                  decryptPassword(passwordItem.password);
                  newVisible.add(id);
                } catch (error) {
                  console.error('Decryption error:', error);
                  Alert.alert('Error', 'Unable to decrypt password');
                }
              }
            }
            return newVisible;
          });
        } else {
          Alert.alert('Authentication failed', 'Could not authenticate using biometrics.');
        }
      } else {
        setCurrentIdToShow(id);
        setIsPinModalVisible(true);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      Alert.alert('Error', 'An error occurred while authenticating.');
    }
  };

  const handlePinSubmit = () => {
    if (enteredPin === '1234') { // Replace with secure PIN validation
      if (currentIdToShow) {
        const existingPassword = passwords.find(item => item.id === currentIdToShow);
        if (existingPassword) {
          try {
            const decryptedPassword = decryptPassword(existingPassword.password);
            setName(existingPassword.name);
            setNewPassword(decryptedPassword);
            setSelectedPasswordId(currentIdToShow);
            setIsEditModalVisible(true);
          } catch (decryptError) {
            console.error('Decryption error:', decryptError);
            Alert.alert(
              'Error',
              'Failed to decrypt password. The stored password might be corrupted.'
            );
          }
        }
      }
      setEnteredPin('');
      setIsPinModalVisible(false);
      setCurrentIdToShow(null);
    } else {
      Alert.alert('Incorrect PIN');
    }
  };
  const renderPasswordItem = ({ item }: { item: PasswordItem }) => {
    let displayPassword = '****';
    if (visiblePasswords.has(item.id)) {
      try {
        displayPassword = decryptPassword(item.password);
        if (!displayPassword) {
          displayPassword = 'Error: Empty password';
        }
      } catch (error) {
        console.error('Decryption error in render:', error);
        displayPassword = 'Error decrypting';
      }
    }

    return (
      <View style={styles.passwordItem}>
        <View style={styles.passwordContent}>
          <Text style={styles.passwordName}>{item.name}</Text>
          <Text style={styles.passwordText} numberOfLines={visiblePasswords.has(item.id) ? undefined : 1}>
            {displayPassword}
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => togglePasswordVisibility(item.id)}
          >
            <Text style={styles.toggleButton}>
              {visiblePasswords.has(item.id) ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleEdit(item.id)}
          >
            <Text style={styles.editButton}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => deletePassword(item.id)}
          >
            <Text style={styles.deleteButton}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setIsAddPasswordModalVisible(true)}
      >
        <Text style={styles.addButtonText}>+ Add New Password</Text>
      </TouchableOpacity>

      <FlatList
        data={passwords}
        keyExtractor={(item) => item.id}
        renderItem={renderPasswordItem}
      />

      <Modal
        transparent={true}
        animationType="slide"
        visible={isAddPasswordModalVisible}
        onRequestClose={() => setIsAddPasswordModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Add New Password</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={name}
              onChangeText={setName}
            />
            
            <View style={styles.passwordInputContainer}>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={24}
                    color="#007AFF"
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.generateButton}
                onPress={generatePassword}
              >
                <Text style={styles.generateButtonText}>Generate</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.strengthIndicator}>
              <Text style={styles.strengthText}>
                Password Strength: {passwordStrength.message}
              </Text>
              <View style={styles.strengthBar}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <View
                    key={level}
                    style={[
                      styles.strengthSegment,
                      {
                        backgroundColor: level <= passwordStrength.score 
                          ? passwordStrength.color 
                          : '#ddd'
                      }
                    ]}
                  />
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setIsAddPasswordModalVisible(false);
                  setName('');
                  setNewPassword('');
                  setShowNewPassword(false);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={addPassword}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent={true}
        animationType="slide"
        visible={isEditModalVisible}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Edit Password</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={name}
              onChangeText={setName}
            />
            
            <View style={styles.passwordInputContainer}>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={24}
                    color="#007AFF"
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.generateButton}
                onPress={generatePassword}
              >
                <Text style={styles.generateButtonText}>Generate</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.strengthIndicator}>
              <Text style={styles.strengthText}>
                Password Strength: {passwordStrength.message}
              </Text>
              <View style={styles.strengthBar}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <View
                    key={level}
                    style={[
                      styles.strengthSegment,
                      {
                        backgroundColor: level <= passwordStrength.score 
                          ? passwordStrength.color 
                          : '#ddd'
                      }
                    ]}
                  />
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setIsEditModalVisible(false);
                  setName('');
                  setNewPassword('');
                  setSelectedPasswordId(null);
                  setShowNewPassword(false);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={updatePassword}
              >
                <Text style={styles.modalButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent={true}
        animationType="slide"
        visible={isPinModalVisible}
        onRequestClose={() => setIsPinModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>Please enter your PIN:</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              keyboardType="numeric"
              onChangeText={setEnteredPin}
              value={enteredPin}
            />
            <Button title="Submit" onPress={handlePinSubmit} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PasswordManagerScreen;

const styles = StyleSheet.create({

    container: {
    marginTop: 46,
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  addButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    marginRight: 10,
    marginBottom: 0,
  },
  generateButton: {
    backgroundColor: '#5856D6',
    padding: 10,
    borderRadius: 8,
  },
  generateButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  strengthIndicator: {
    marginBottom: 20,
  },
  strengthText: {
    marginBottom: 5,
  },
  strengthBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  strengthSegment: {
    flex: 1,
    marginHorizontal: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  modalButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 8,
    borderRadius: 5,
  },
  passwordItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  passwordContent: {
    flex: 1,
    marginBottom: 8,
  },
  passwordName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  passwordText: {
    fontSize: 14,
    color: '#666',
    flexWrap: 'wrap',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    borderRadius: 4,
  },
  toggleButton: {
    color: '#007AFF',
  },
  editButton: {
    color: '#007AFF',
  },
  deleteButton: {
    color: '#FF3B30',
  },
  modalText: {
    fontSize: 18,
    marginBottom: 10,
    color: '#fff',
  },
  eyeButton: {
    padding: 10,
    position: 'absolute',
    right: 10, 
    zIndex: 1,
  },
  passwordInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginRight: 10,
  },

});
